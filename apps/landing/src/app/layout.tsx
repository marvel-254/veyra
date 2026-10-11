import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Veyra — Free Movies & Series',
  description:
    'Download Veyra for Android. Stream trailers or download full movies and series to your device — completely free, no account needed.',
  keywords: ['Veyra', 'movies', 'series', 'download', 'android', 'free'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
