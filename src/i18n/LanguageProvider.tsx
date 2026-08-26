'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isLocale, LOCALE_COOKIE, LOCALE_STORAGE_KEY, type Locale } from './locale';
import { setStoreLocale } from './locale-store';
import { interpolate, resolveMessage, type MessageKey } from './translations';

interface LanguageContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function applyLocale(next: Locale, persist: boolean) {
    setStoreLocale(next);
    document.documentElement.lang = next;
    if (!persist) return;
    try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
        /* localStorage indisponível (modo privado, cookies bloqueados, etc.) — segue só com o cookie */
    }
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale);

    useEffect(() => {
        // Reconcilia com o localStorage no primeiro carregamento: cobre o caso raro de
        // cookies bloqueados/limpos onde só o localStorage ainda tem a preferência salva.
        let stored: string | null = null;
        try {
            stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        } catch {
            stored = null;
        }
        if (isLocale(stored) && stored !== initialLocale) {
            // Must run post-hydration (not during the initial render) so the first client
            // render still matches the server-rendered HTML and avoids a hydration mismatch.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLocaleState(stored);
            applyLocale(stored, true);
        } else {
            applyLocale(initialLocale, false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value = useMemo<LanguageContextValue>(
        () => ({
            locale,
            setLocale: (next) => {
                setLocaleState(next);
                applyLocale(next, true);
            },
            t: (key, vars) => interpolate(resolveMessage(locale, key), vars),
        }),
        [locale],
    );

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useTranslation deve ser usado dentro de um LanguageProvider.');
    return context;
}
