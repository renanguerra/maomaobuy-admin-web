import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/m-plus-2';
import './globals.css';

export const metadata: Metadata = {
    title: 'MaoMaoBuy Admin',
    description: 'Painel administrativo interno da MaoMaoBuy.',
    robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning>
            <body className="flex min-h-screen flex-col bg-background">{children}</body>
        </html>
    );
}
