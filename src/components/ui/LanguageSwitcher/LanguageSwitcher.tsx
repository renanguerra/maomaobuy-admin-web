'use client';

import { Languages } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageProvider';
import { LOCALES, LOCALE_NAMES, isLocale } from '@/i18n/locale';

export interface LanguageSwitcherProps {
    /** `surface`: painéis claros (ex.: tela de login). `inverted`: fundo escuro da sidebar. */
    variant?: 'surface' | 'inverted';
    className?: string;
}

export function LanguageSwitcher({ variant = 'surface', className = '' }: LanguageSwitcherProps) {
    const { locale, setLocale, t } = useTranslation();

    const variants = {
        surface:
            'border-line bg-surface text-ink hover:border-brand-300 dark:border-night-line dark:bg-night-surface dark:text-night-text',
        inverted: 'border-white/20 bg-white/10 text-white hover:bg-white/15',
    };

    return (
        <label
            className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold transition max-[900px]:max-w-28 ${variants[variant]} ${className}`}
        >
            <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">{t('language.label')}</span>
            <select
                className="min-h-9 min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent pr-1 text-xs font-semibold outline-none"
                value={locale}
                aria-label={t('language.label')}
                onChange={(event) => {
                    if (isLocale(event.target.value)) setLocale(event.target.value);
                }}
            >
                {LOCALES.map((value) => (
                    <option className="text-ink" key={value} value={value}>
                        {LOCALE_NAMES[value]}
                    </option>
                ))}
            </select>
        </label>
    );
}
