import { NextResponse } from 'next/server';
import { supabaseServer } from './supabase-server';
import type { UserRole } from './types';

export async function requireUser() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  return { user, supabase, error: null };
}

export async function requireRole(roles: UserRole[]) {
  const { user, supabase, error } = await requireUser();
  if (error || !user || !supabase) return { error: error!, user: null, role: null, supabase: null };
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (pErr || !profile) {
    return {
      error: NextResponse.json({ error: 'Profile missing' }, { status: 403 }),
      user: null, role: null, supabase: null,
    };
  }
  if (!roles.includes(profile.role)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null, role: null, supabase: null,
    };
  }
  return { user, role: profile.role as UserRole, supabase, error: null };
}
