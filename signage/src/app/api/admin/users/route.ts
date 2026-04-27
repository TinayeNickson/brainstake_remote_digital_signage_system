import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const schema = z.object({
  id: z.string().uuid(),
  role: z.enum(['customer', 'accountant', 'admin']),
});

/**
 * PATCH /api/admin/users
 *
 * Changes a user's role. Only admins can call this. We use the service-role
 * client here because the profiles.role RLS is deliberately strict — the
 * profiles_self_update policy forbids changing role, so a normal user can
 * never promote themselves, and the profiles_admin_all policy allows admin
 * writes. We still gate at the API layer defensively.
 */
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireRole(['admin']);
  if (error || !user) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { id, role } = parsed.data;

  // Safety: an admin cannot demote themselves — that would be a foot-gun,
  // and the system requires at least one admin at all times.
  if (id === user.id && role !== 'admin') {
    return NextResponse.json(
      { error: "You can't change your own role. Ask another admin." },
      { status: 409 },
    );
  }

  const admin = supabaseAdmin();
  const { data, error: uErr } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select('id, email, full_name, role')
    .single();

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  return NextResponse.json({ profile: data });
}
