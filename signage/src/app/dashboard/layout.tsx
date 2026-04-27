import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import AppShell from '@/components/AppShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let { data: profile } = await supabase
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', user.id)
    .single();

  if (!profile) {
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
      role: 'customer',
    });
    const { data: fresh } = await supabase
      .from('profiles')
      .select('role, email, full_name')
      .eq('id', user.id)
      .single();
    if (!fresh) redirect('/login');
    profile = fresh;
  }

  return (
    <AppShell role={profile.role} email={profile.email} fullName={profile.full_name}>
      {children}
    </AppShell>
  );
}
