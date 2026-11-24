/** Texto para comparar na busca: sem acento, sem caixa. */
export function normalize(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}
