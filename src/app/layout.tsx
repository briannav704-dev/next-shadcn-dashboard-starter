import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import Providers from '@/components/layout/providers';
import { fontVariables } from '@/components/themes/font.config';
import ThemeProvider from '@/components/themes/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

import '../styles/globals.css';

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL) }
    : {}),
  title: { default: 'Kouture Life OS', template: '%s · Kouture' },
  description: 'Private personal and business operating system for Kouture Nail Bar.',
  applicationName: 'Kouture',
  appleWebApp: { capable: true, title: 'Kouture', statusBarStyle: 'default' },
  robots: { index: false, follow: false, nocache: true },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF7F2' },
    { media: '(prefers-color-scheme: dark)', color: '#1D1618' }
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={cn(
          'bg-background overflow-x-hidden overscroll-none font-sans antialiased',
          fontVariables
        )}
      >
        <NextTopLoader color='var(--champagne)' showSpinner={false} height={2} />
        <NuqsAdapter>
          <ThemeProvider
            attribute='class'
            defaultTheme='light'
            enableSystem
            disableTransitionOnChange
            enableColorScheme
          >
            <Providers>
              <Toaster />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
