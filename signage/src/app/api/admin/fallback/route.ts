import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const createSchema = z.object({
  title:        z.string().min(1).max(120),
  content_url:  z.string().url(),
  content_type: z.enum(['image', 'video']).default('image'),
  is_active:    z.boolean().optional().default(true),
  sort_order:   z.number().int().min(0).optional().default(0),
});

const updateSchema = z.object({
  id:           z.string().uuid(),
  title:        z.string().min(1).max(120).optional(),
  content_url:  z.string().url().optional(),
  content_type: z.enum(['image', 'video']).optional(),
  is_active:    z.boolean().optional(),
  sort_order:   z.number().int().min(0).optional(),
});

export async function PUT(req: NextRequest) {
  const { error, user } = await requireRole(['admin']);
  if (error || !user) return error;

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

  const file        = formData.get('file') as File | null;
  const title       = formData.get('title') as string | null;
  const contentType = (formData.get('content_type') as string | null) ?? 'image';
  const sortOrder   = parseInt(formData.get('sort_order') as string ?? '0', 10);

  if (!file || !title) {
    return NextResponse.json({ error: 'file and title are required' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const ext  = file.name.split('.').pop() ?? 'bin';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: upErr } = await admin.storage
    .from('fallback-media')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: `Storage: ${upErr.message}` }, { status: 400 });

  const { data: pub } = admin.storage.from('fallback-media').getPublicUrl(path);

  const { data, error: iErr } = await admin
    .from('fallback_content')
    .insert({
      title,
      content_url:  pub.publicUrl,
      content_type: contentType,
      is_active:    true,
      sort_order:   sortOrder,
      created_by:   user.id,
    })
    .select()
    .single();
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });

  return NextResponse.json({ item: data });
}

export async function GET() {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('fallback_content')
    .select('id, title, content_url, content_type, is_active, sort_order, created_at')
    .order('sort_order')
    .order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { supabase, error, user } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', detail: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error: iErr } = await supabase
    .from('fallback_content')
    .insert({ ...parsed.data, created_by: user!.id })
    .select()
    .single();
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', detail: parsed.error.flatten() }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;

  const { data, error: uErr } = await supabase
    .from('fallback_content')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error: dErr } = await supabase
    .from('fallback_content')
    .delete()
    .eq('id', id);
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
