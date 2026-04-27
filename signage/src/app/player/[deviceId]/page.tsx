import PlayerClient from './client';

// Player renders outside the main app chrome — fullscreen, dark.
export default function PlayerPage({
  params,
  searchParams,
}: {
  params: { deviceId: string };
  searchParams: { token?: string };
}) {
  return <PlayerClient deviceId={params.deviceId} token={searchParams.token} />;
}
