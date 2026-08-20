import ErrorBoundary from '@/components/ErrorBoundary';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata = {
  title: 'Lời Chúa hằng ngày',
  description: 'Lời Chúa (Tin Mừng) mỗi ngày',
  icons: {
    icon: { url: '/favicon.svg', type: 'image/svg+xml' },
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className="font-sans flex flex-col min-h-screen">
        <header className="bg-green-700 text-white shadow-md">
          <div className="max-w-6xl mx-auto py-3 px-4">
            <span className="text-xl font-bold">📖 Lời Chúa hằng ngày</span>
          </div>
        </header>

        <main className="w-full max-w-6xl mx-auto px-4 py-6 flex-grow">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>

        <Analytics />
      </body>
    </html>
  );
}
