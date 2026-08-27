export const LOCALES = ['pt-BR', 'zh-Hans'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'pt-BR';

/** Nome de cada idioma exibido no seu próprio idioma, independente do idioma atual da UI. */
export const LOCALE_NAMES: Record<Locale, string> = {
    'pt-BR': 'Português (Brasil)',
    'zh-Hans': '简体中文',
};

/** BCP-47 usado por `Intl.DateTimeFormat`/`Intl.NumberFormat` para cada idioma da UI. */
export const LOCALE_INTL_TAG: Record<Locale, string> = {
    'pt-BR': 'pt-BR',
    'zh-Hans': 'zh-CN',
};

export const LOCALE_COOKIE = 'admin_locale';
export const LOCALE_STORAGE_KEY = 'admin_locale';

export function isLocale(value: string | undefined | null): value is Locale {
    return value !== undefined && value !== null && (LOCALES as readonly string[]).includes(value);
}

/** Sigla curta usada no seletor compacto da barra lateral. */
export const LOCALE_SHORT_NAMES: Record<Locale, string> = {
    'pt-BR': 'PT-BR',
    'zh-Hans': '中文',
};
