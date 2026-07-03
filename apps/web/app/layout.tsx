import './globals.css';
import { DM_Serif_Display, DM_Sans } from 'next/font/google';
import type { Metadata } from 'next';
import { PostHogProvider } from './PostHogProvider';

const serif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['italic', 'normal'],
  variable: '--font-display',
  display: 'swap',
});

const sans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Runivo — Own your city',
  description: 'Claim territory, earn PACE, and dominate your city. The running app that turns your miles into a competitive game.',
  openGraph: {
    title: 'Runivo — Own your city',
    description: 'Claim territory, earn PACE, and dominate your city.',
    type: 'website',
    siteName: 'Runivo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Runivo — Own your city',
    description: 'Claim territory, earn PACE, and dominate your city.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body style={{ fontFamily: 'var(--font-body)' }}>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
