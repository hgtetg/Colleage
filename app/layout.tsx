import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://campus-hub-student-ledger.trevor-2877.chatgpt.site'),
  title: 'Campus Hub',
  description: 'Your course. Your people. One place.',
  openGraph: {
    title: 'Campus Hub',
    description: 'Your course. Your people. One place.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Campus Hub modern campus workspace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Campus Hub',
    description: 'Your course. Your people. One place.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
