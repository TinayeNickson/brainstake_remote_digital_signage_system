import { supabaseServer } from '@/lib/supabase-server';
import UsersClient from './client';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, created_at')
    .order('created_at', { ascending: false });

  return <UsersClient initial={users ?? []} currentUserId={user?.id ?? ''} />;
}
