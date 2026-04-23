import '@eleva/ui/globals.css';

export const metadata = {
  title: 'Eleva.care — App',
  description: 'Authenticated product surface for Eleva.care',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
