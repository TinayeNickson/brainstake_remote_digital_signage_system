import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brainstake · Digital Signage System',
  description:
    'Book, pay for, and publish adverts across a network of digital screens. Brainstake is the operations console for outdoor and indoor signage.',
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
