import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RAREVISION — WE FOLLOW THE DREAM',
  description: 'Upload content, book screens, and go live in minutes.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
