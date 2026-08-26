import { DEFAULT_LOCALE, type Locale } from './locale';

/**
 * Cópia do idioma atual fora da árvore React, para uso por funções puras
 * (labels de status, `formatDate`) que não podem chamar hooks. Mantida em
 * sincronia pelo `LanguageProvider`, seguindo o mesmo padrão de estado
 * module-level de `services/auth/admin-account-auth.ts`.
 */
let current: Locale = DEFAULT_LOCALE;

export function getStoreLocale(): Locale {
    return current;
}

export function setStoreLocale(locale: Locale) {
    current = locale;
}
