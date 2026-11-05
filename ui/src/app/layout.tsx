import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AeroGraph Tactical Console',
  description: 'Falcon BMS 4.38 Avionics & Kneeboard System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-void-0 text-text-primary antialiased select-none overflow-hidden h-screen w-screen border border-border-hairline rounded-lg">
        {children}
      </body>
    </html>
  );
}
