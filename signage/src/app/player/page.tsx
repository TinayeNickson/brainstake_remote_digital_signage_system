import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * /player?code=ABC123
 *
 * Resolves a pairing code to a device and redirects to the full player URL.
 * Used for web displays that are configured via a short URL with just a code.
 */
export default async function PlayerIndexPage({
  searchParams,
}: {
  searchParams: { code?: string; token?: string };
}) {
  const code = searchParams.code?.toUpperCase().trim();

  if (code) {
    const admin = supabaseAdmin();
    const { data: device } = await admin
      .from('devices')
      .select('id, api_token')
      .eq('pairing_code', code)
      .maybeSingle();

    if (device) {
      redirect(`/player/${device.id}?token=${device.api_token}`);
    }
  }

  // No code or invalid code — show entry form
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Brainstake Player</h1>
          <p className="text-white/50 text-sm mt-1">Enter your device pairing code</p>
        </div>

        <form action="/player" method="GET" className="space-y-3">
          <input
            name="code"
            type="text"
            placeholder="e.g. ABC123"
            maxLength={10}
            autoComplete="off"
            autoCapitalize="characters"
            className="w-full h-14 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/30 text-center text-2xl font-mono tracking-[0.3em] uppercase focus:outline-none focus:border-white/40 px-4"
          />
          {searchParams.code && (
            <p className="text-red-400 text-sm text-center">Invalid code. Please check and try again.</p>
          )}
          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-white text-black font-bold text-[15px] hover:bg-white/90 transition-colors"
          >
            Connect Screen
          </button>
        </form>
      </div>
    </div>
  );
}
