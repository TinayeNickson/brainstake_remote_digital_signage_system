import { supabaseServer } from '@/lib/supabase-server';
import FallbackClient from './client';

export const dynamic = 'force-dynamic';

export default async function FallbackPage() {
  const supabase = supabaseServer();
  const { data: items } = await supabase
    .from('fallback_content')
    .select('id, title, content_url, content_type, is_active, sort_order, created_at')
    .order('sort_order')
    .order('created_at');

  return <FallbackClient initial={items ?? []} />;
}
