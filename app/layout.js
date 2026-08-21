import ErrorBoundary from '@/components/ErrorBoundary';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Inter, Merriweather } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['vietnamese', 'latin'],
  variable: '--font-sans',
  display: 'swap',
});

const merriweather = Merriweather({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata = {
  title: 'Lời Chúa hằng ngày',
  description: 'Lời Chúa (Tin Mừng) mỗi ngày',
  icons: {
    icon: { url: '/favicon.svg', type: 'image/svg+xml' },
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${inter.variable} ${merriweather.variable}`}>
      <body className="font-sans flex flex-col min-h-screen bg-stone-100 text-neutral-800">
        <header className="sticky top-0 z-30 bg-emerald-800 text-white shadow-md">
          <div className="max-w-6xl mx-auto py-3 px-4 flex items-center gap-2.5">
            <span className="text-2xl leading-none">📖</span>
            <div className="leading-tight">
              <p className="text-lg sm:text-xl font-bold tracking-tight">Lời Chúa hằng ngày</p>
              <p className="hidden sm:block text-xs text-emerald-100/80">Tin Mừng mỗi ngày theo lịch Phụng Vụ</p>
            </div>
          </div>
        </header>

        <main className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-10 flex-grow">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>

        <footer className="text-center text-xs text-neutral-400 py-6">
          Lời Chúa hằng ngày · dữ liệu phụng vụ &amp; Tin Mừng theo lịch Công Giáo
        </footer>

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
