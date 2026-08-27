'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Theme } from '@/enum/theme';

const THEME_CHANGE_EVENT = 'maomaobuy-admin-theme-change';
const THEME_STORAGE_KEY = 'maomaobuy-admin-theme';

function readTheme(): Theme {
    return document.documentElement.dataset.theme === Theme.Dark ? Theme.Dark : Theme.Light;
}

function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        /* localStorage indisponível (modo privado) — o tema vale só para esta aba */
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/**
 * Tema do painel. O admin fica horas na mesma tela, então a preferência é
 * persistida por navegador e o padrão segue o sistema operacional.
 */
export function useTheme() {
    const theme = useSyncExternalStore(
        (onChange) => {
            window.addEventListener(THEME_CHANGE_EVENT, onChange);
            return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
        },
        readTheme,
        () => Theme.Light,
    );

    useEffect(() => {
        let saved: string | null = null;
        try {
            saved = localStorage.getItem(THEME_STORAGE_KEY);
        } catch {
            saved = null;
        }
        applyTheme(
            saved === Theme.Light || saved === Theme.Dark
                ? saved
                : matchMedia('(prefers-color-scheme: dark)').matches
                  ? Theme.Dark
                  : Theme.Light,
        );
    }, []);

    return { theme, toggleTheme: () => applyTheme(theme === Theme.Dark ? Theme.Light : Theme.Dark) };
}
