import './globals.css';
import { Outfit } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import { PostHogProvider } from './PostHogProvider';

// The one typeface of the app (apps/mobile/src/theme/typography.ts): Outfit 400-700.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});

const TITLE = 'Runivo — Run smarter';
const DESCRIPTION = 'AI coaching, live crews and your city. Every run you record can claim real ground on the map.';

export const metadata: Metadata = {
  metadataBase: new URL('https://runivo.app'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    siteName: 'Runivo',
    images: [{ url: '/images/welcome-runner.jpg', width: 680, height: 820, alt: 'A runner mid-stride inside the Runivo hexagon' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/images/welcome-runner.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#F4F5F1',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
