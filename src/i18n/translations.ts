import type { Locale } from './locale';
import { ptBR, type Messages } from './dictionaries/pt-br';
import { zhHans } from './dictionaries/zh-hans';

export const dictionaries: Record<Locale, Messages> = {
    'pt-BR': ptBR,
    'zh-Hans': zhHans,
};

/** União de todos os caminhos "a.b.c" possíveis dentro de `Messages`. */
export type MessageKey = DotPaths<Messages>;

type DotPaths<T> = T extends string
    ? never
    : {
          [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
      }[keyof T & string];

export function resolveMessage(locale: Locale, key: MessageKey): string {
    const parts = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = dictionaries[locale];
    for (const part of parts) node = node?.[part];
    if (typeof node !== 'string') return key;
    return node;
}

/**
 * Devolver o `{{campo}}` cru quando falta a variável transforma um esquecimento
 * de quem chamou `t()` em texto visível para o admin. Some com o marcador e
 * grita no console fora de produção, onde ainda dá para corrigir.
 */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
        if (vars && name in vars) return String(vars[name]);
        if (process.env.NODE_ENV !== 'production')
            console.warn(`i18n: variável "${name}" não foi informada para a mensagem "${template}".`);
        return '';
    });
}
