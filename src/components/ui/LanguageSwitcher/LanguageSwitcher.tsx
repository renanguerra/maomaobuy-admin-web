'use client';

import { useId } from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageProvider';
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT_NAMES, isLocale } from '@/i18n/locale';

export interface LanguageSwitcherProps {
    /** `surface`: painéis claros (ex.: tela de login). `inverted`: fundo escuro da sidebar. */
    variant?: 'surface' | 'inverted';
    /** `compact` mostra a sigla do idioma; `full`, o nome por extenso. */
    display?: 'compact' | 'full';
    className?: string;
}

const VARIANTS = {
    surface:
        'border-line bg-surface text-ink hover:border-brand-300 dark:border-night-line dark:bg-night-raised dark:text-night-text',
    inverted: 'border-white/20 bg-white/10 text-white hover:bg-white/18',
};

export function LanguageSwitcher({ variant = 'surface', display = 'compact', className = '' }: LanguageSwitcherProps) {
    const selectId = useId();
    const { locale, setLocale, t } = useTranslation();

    return (
        <div
            className={`relative inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition ${VARIANTS[variant]} ${className}`}
        >
            <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <label className="sr-only" htmlFor={selectId}>
                {t('language.label')}
            </label>
            <span className="pointer-events-none truncate">
                {display === 'compact' ? LOCALE_SHORT_NAMES[locale] : LOCALE_NAMES[locale]}
            </span>
            <select
                className="absolute inset-0 cursor-pointer opacity-0"
                id={selectId}
                value={locale}
                onChange={(event) => {
                    if (isLocale(event.target.value)) setLocale(event.target.value);
                }}
            >
                {LOCALES.map((value) => (
                    <option key={value} value={value}>
                        {LOCALE_NAMES[value]}
                    </option>
                ))}
            </select>
        </div>
    );
}
