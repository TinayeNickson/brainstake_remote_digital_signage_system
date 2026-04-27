import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import PaymentForm from './form';

export const dynamic = 'force-dynamic';

export default async function PaymentPage({ params }: { params: { bookingId: string } }) {
  const supabase = supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: booking }, { data: settings }] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id, status, total_price, start_date, end_date, duration, slots_per_day,
        customer_id,
        ad:ads(title),
        location:locations(name)
      `)
      .eq('id', params.bookingId)
      .single(),
    supabase
      .from('payment_settings')
      .select('method, label, instructions, is_enabled, sort_order')
      .eq('is_enabled', true)
      .order('sort_order'),
  ]);

  if (!booking || booking.customer_id !== user.id) redirect('/dashboard');

  return <PaymentForm booking={booking as any} paymentSettings={settings ?? []} />;
}
