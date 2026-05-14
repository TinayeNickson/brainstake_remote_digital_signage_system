-- ============================================================================
-- migration_fix_messages_v19.sql
-- Fix message delivery and add storage for attachments
-- ============================================================================

-- ============================================================================
-- 1. FIX: Get all conversations for admin (include messages to admin with NULL recipient)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_conversations()
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  customer_email text,
  last_message_at timestamptz,
  unread_count bigint,
  last_message_preview text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id as customer_id,
    p.full_name as customer_name,
    p.email as customer_email,
    MAX(m.created_at) as last_message_at,
    COUNT(*) FILTER (WHERE m.is_read = false AND m.is_from_customer = true)::bigint as unread_count,
    (SELECT content FROM public.messages m2 
     WHERE (m2.sender_id = p.id OR m2.recipient_id = p.id OR (m2.sender_id = p.id AND m2.recipient_id IS NULL)) 
     ORDER BY m2.created_at DESC LIMIT 1) as last_message_preview
  FROM public.profiles p
  JOIN public.messages m ON (
    m.sender_id = p.id OR 
    m.recipient_id = p.id OR 
    (m.sender_id = p.id AND m.recipient_id IS NULL)  -- Messages from customer to admin
  )
  WHERE p.role = 'customer'
  GROUP BY p.id, p.full_name, p.email
  ORDER BY MAX(m.created_at) DESC;
$$;

-- ============================================================================
-- 2. FIX: Get unread count (must include messages to admin with NULL recipient)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.messages
  WHERE (
    recipient_id = p_user_id OR 
    (recipient_id IS NULL AND NOT is_from_customer AND p_user_id IN (SELECT id FROM profiles WHERE role = 'admin'))
  )
    AND is_read = false;
$$;

-- ============================================================================
-- 3. STORAGE: Create bucket for message attachments
-- ============================================================================
-- Create the bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  true,
  10485760,  -- 10MB limit
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 4. STORAGE POLICIES: Allow authenticated users to upload/download
-- ============================================================================

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to download their own files or any file (public bucket)
CREATE POLICY "Allow authenticated downloads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'message-attachments');

-- Policy: Allow users to delete their own files
CREATE POLICY "Allow owners to delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- 5. FIX RLS: Ensure messages SELECT policy allows admin to see all
-- ============================================================================

-- Drop and recreate admin policy to ensure it's working
DROP POLICY IF EXISTS messages_admin_all ON public.messages;
CREATE POLICY messages_admin_all ON public.messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 6. GRANTS
-- ============================================================================
grant execute on function public.get_unread_count(uuid) to authenticated;
grant execute on function public.get_admin_conversations() to authenticated;

-- ============================================================================
-- 7. INDEXES for performance
-- ============================================================================
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_recipient_created_idx on public.messages (recipient_id, created_at desc);
create index if not exists messages_null_recipient_idx on public.messages (recipient_id) where recipient_id is null;
