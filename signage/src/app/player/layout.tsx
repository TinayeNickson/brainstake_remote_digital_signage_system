export const metadata = { title: 'Player' };

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 bg-black text-white overflow-hidden">{children}</div>;
}
