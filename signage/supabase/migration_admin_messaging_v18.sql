-- ============================================================================
-- migration_admin_messaging_v18.sql
-- Admin adverts dashboard + Customer-Admin messaging + Design workflow
-- ============================================================================

-- ============================================================================
-- 1. MESSAGES TABLE — Customer ↔ Admin communication
-- ============================================================================
create table if not exists public.messages (
  id              uuid        primary key default gen_random_uuid(),
  sender_id       uuid        not null references public.profiles(id) on delete cascade,
  recipient_id    uuid        references public.profiles(id) on delete cascade,  -- null = broadcast to admin
  campaign_id     uuid        references public.campaigns(id) on delete cascade,    -- linked campaign (optional)
  subject         text        not null default 'General Inquiry',
  content         text        not null,
  message_type    text        not null default 'general',  -- general, design_request, design_review, support
  attachment_url  text,                                      -- optional media/design file
  is_read         boolean     not null default false,
  is_from_customer boolean    not null default true,         -- direction flag
  parent_id       uuid        references public.messages(id) on delete cascade,  -- for threading
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists messages_sender_idx    on public.messages (sender_id);
create index if not exists messages_recipient_idx on public.messages (recipient_id);
create index if not exists messages_campaign_idx  on public.messages (campaign_id);
create index if not exists messages_type_idx      on public.messages (message_type);
create index if not exists messages_unread_idx    on public.messages (recipient_id, is_read) where is_read = false;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_messages_updated_at ON public.messages;
CREATE TRIGGER set_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. DESIGN REQUESTS TABLE — Design workflow tracking
-- ============================================================================
create table if not exists public.design_requests (
  id              uuid        primary key default gen_random_uuid(),
  customer_id     uuid        not null references public.profiles(id) on delete cascade,
  campaign_id     uuid        references public.campaigns(id) on delete set null,  -- linked campaign
  ad_id           uuid        references public.ads(id) on delete set null,          -- linked ad
  title           text        not null,
  description     text        not null,                       -- what customer wants
  design_type     text        not null default 'advert',      -- advert, banner, video
  status          text        not null default 'pending',     -- pending, in_progress, submitted, approved, rejected, revision_requested
  design_url      text,                                       -- uploaded design file
  admin_notes     text,                                       -- admin comments
  customer_feedback text,                                     -- customer review comments
  submitted_at    timestamptz,                                -- when admin submitted design
  reviewed_at     timestamptz,                                -- when customer reviewed
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists design_requests_customer_idx on public.design_requests (customer_id);
create index if not exists design_requests_status_idx   on public.design_requests (status);
create index if not exists design_requests_campaign_idx on public.design_requests (campaign_id);

DROP TRIGGER IF EXISTS set_design_requests_updated_at ON public.design_requests;
CREATE TRIGGER set_design_requests_updated_at
  BEFORE UPDATE ON public.design_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Messages: Customers see their own messages, Admins see all
alter table public.messages enable row level security;

-- Policy: Customers can insert their own messages
CREATE POLICY messages_customer_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'customer')
  );

-- Policy: Customers can view messages they sent or received
CREATE POLICY messages_customer_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid() OR recipient_id = auth.uid() OR
    (recipient_id IS NULL AND is_from_customer = false)  -- admin replies to broadcast
  );

-- Policy: Customers can update only their own messages (mark as read)
CREATE POLICY messages_customer_update ON public.messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Policy: Admins full access
CREATE POLICY messages_admin_all ON public.messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Design Requests: Customers see their own, Admins see all
alter table public.design_requests enable row level security;

CREATE POLICY design_requests_customer_select ON public.design_requests
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY design_requests_customer_insert ON public.design_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'customer')
  );

CREATE POLICY design_requests_customer_update ON public.design_requests
  FOR UPDATE TO authenticated
  USING (
    (customer_id = auth.uid() AND status IN ('pending', 'submitted', 'revision_requested')))  -- can update feedback only
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY design_requests_admin_all ON public.design_requests
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 4. RPC FUNCTIONS
-- ============================================================================

-- Get unread message count for user
CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.messages
  WHERE (recipient_id = p_user_id OR (recipient_id IS NULL AND NOT is_from_customer))
    AND is_read = false;
$$;

-- Get all conversations for admin (grouped by customer)
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
     WHERE (m2.sender_id = p.id OR m2.recipient_id = p.id) 
     ORDER BY m2.created_at DESC LIMIT 1) as last_message_preview
  FROM public.profiles p
  JOIN public.messages m ON (m.sender_id = p.id OR m.recipient_id = p.id)
  WHERE p.role = 'customer'
  GROUP BY p.id, p.full_name, p.email
  ORDER BY MAX(m.created_at) DESC;
$$;

-- Mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_user_id uuid,
  p_other_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET is_read = true
  WHERE recipient_id = p_user_id
    AND is_read = false
    AND (p_other_user_id IS NULL OR sender_id = p_other_user_id);
END;
$$;

-- Update design request status (with validation)
CREATE OR REPLACE FUNCTION public.update_design_request_status(
  p_request_id uuid,
  p_new_status text,
  p_design_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_user_role public.user_role;
BEGIN
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  
  SELECT * INTO v_request FROM public.design_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Admin can set any status
  IF v_user_role = 'admin' THEN
    UPDATE public.design_requests
    SET status = p_new_status,
        design_url = COALESCE(p_design_url, design_url),
        admin_notes = COALESCE(p_notes, admin_notes),
        submitted_at = CASE WHEN p_new_status = 'submitted' THEN now() ELSE submitted_at END
    WHERE id = p_request_id;
    RETURN true;
  END IF;
  
  -- Customer can only approve/reject/revision when status is 'submitted'
  IF v_request.customer_id = auth.uid() AND v_request.status = 'submitted' 
     AND p_new_status IN ('approved', 'rejected', 'revision_requested') THEN
    UPDATE public.design_requests
    SET status = p_new_status,
        customer_feedback = COALESCE(p_notes, customer_feedback),
        reviewed_at = now()
    WHERE id = p_request_id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- ============================================================================
-- 5. GRANTS
-- ============================================================================
grant execute on function public.get_unread_count(uuid) to authenticated, anon;
grant execute on function public.get_admin_conversations() to authenticated;
grant execute on function public.mark_messages_read(uuid, uuid) to authenticated;
grant execute on function public.update_design_request_status(uuid, text, text, text) to authenticated;

-- ============================================================================
-- 6. NOTIFICATION TRIGGERS (optional: auto-notify admin on new customer message)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Could integrate with external notification service here
  -- For now, we rely on the unread count API
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_new_message ON public.messages;
CREATE TRIGGER tr_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();
