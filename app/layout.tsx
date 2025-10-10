// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ScriptLoader from '@/components/loader/ScriptLoader';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Indoor Navigation Assistant',
  description: 'Signolog',
  generator:'alinahmettekin',

};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ScriptLoader />
        {children}
      </body>
    </html>
  );
}