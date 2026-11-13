import type { Metadata } from 'next';
import './globals.css';
import { themeScript } from '@/lib/theme';

export const metadata: Metadata = {
  title: { default: 'Contas a Dois', template: '%s · Contas a Dois' },
  description:
    'Uma visão clara das despesas, das cotas e dos repasses do casal.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
