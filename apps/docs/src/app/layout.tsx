import '@eleva/ui/globals.css';

export const metadata = {
  title: 'Eleva.care — Docs',
  description: 'Public documentation and compliance references',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
