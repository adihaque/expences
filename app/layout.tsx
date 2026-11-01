import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Bengali } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';

const font = Noto_Sans_Bengali({ subsets: ['bengali', 'latin'], display: 'swap' });
export const metadata: Metadata = { title: 'খরচ · AI Expense Tracker', description: 'Chat-first personal expense tracker (BDT)' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#059669' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={font.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}</ThemeProvider>
      </body>
    </html>
  );
}
