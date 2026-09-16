import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'My ai — Il tuo arcipelago',
  description: 'Una chat, quattro isole e una memoria personale che scegli tu.',
  robots: { index: false, follow: false },
  applicationName: 'My ai',
  appleWebApp: { capable: true, title: 'My ai', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#f8f6ef', viewportFit: 'cover' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}</body></html>;
}
