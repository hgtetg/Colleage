import type { Metadata } from 'next';
import GoogleTranslate from '@/components/google-translate';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://campus-hub.hatemkhaleefah3.workers.dev'),
  title: {
    default: 'Campus Hub',
    template: '%s · Campus Hub',
  },
  description:
    'A secure course workspace for students, representatives, schedules, materials, study rooms and campus communities.',
  openGraph: {
    title: 'Campus Hub',
    description: 'Your course. Your people. One secure place.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Campus Hub modern campus workspace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Campus Hub',
    description: 'Your course. Your people. One secure place.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <GoogleTranslate />
      </body>
    </html>
  );
}
