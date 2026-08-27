'use client';

import { Moon, Sun } from 'lucide-react';
import { Theme } from '@/enum/theme';
import { useTranslation } from '@/i18n/LanguageProvider';
import { useTheme } from '@/services/theme/theme';

export interface ThemeToggleProps {
    /** `inverted` para o fundo escuro da barra lateral. */
    variant?: 'surface' | 'inverted';
    className?: string;
}

const VARIANTS = {
    surface:
        'border-line bg-surface text-muted hover:border-brand-300 hover:text-ink dark:border-night-line dark:bg-night-raised dark:text-night-muted dark:hover:text-night-text',
    inverted: 'border-white/20 bg-white/10 text-white hover:bg-white/18',
};

export function ThemeToggle({ variant = 'surface', className = '' }: ThemeToggleProps) {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === Theme.Dark;

    return (
        <button
            className={`inline-grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border transition ${VARIANTS[variant]} ${className}`}
            type="button"
            onClick={toggleTheme}
            aria-pressed={isDark}
            title={isDark ? t('theme.toLight') : t('theme.toDark')}
        >
            {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            <span className="sr-only">{isDark ? t('theme.toLight') : t('theme.toDark')}</span>
        </button>
    );
}
