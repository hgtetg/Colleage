import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Campus Hub',
  description: 'Your course, organized by the person who is actually in it.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
