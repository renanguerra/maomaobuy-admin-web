import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import '@fontsource-variable/inter';
import '@fontsource-variable/m-plus-2';
import '@fontsource-variable/noto-sans-sc';
import './globals.css';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/locale';
import { LanguageProvider } from '@/i18n/LanguageProvider';
import { resolveMessage } from '@/i18n/translations';

async function getRequestLocale(): Promise<Locale> {
    const store = await cookies();
    const cookieLocale = store.get(LOCALE_COOKIE)?.value;
    return isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getRequestLocale();
    return {
        title: 'MaoMaoBuy Admin',
        description: resolveMessage(locale, 'meta.description'),
        robots: { index: false, follow: false },
    };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
    const locale = await getRequestLocale();

    return (
        <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
            <body className="flex min-h-screen flex-col bg-background">
                <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
            </body>
        </html>
    );
}
