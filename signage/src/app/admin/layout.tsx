import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import AppShell from '@/components/AppShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role, email, full_name').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') redirect('/dashboard');

  return (
    <AppShell role={profile.role} email={profile.email} fullName={profile.full_name}>
      {children}
    </AppShell>
  );
}
