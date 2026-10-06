import { api } from '@/services/api';
import type { Page } from '@/types/api';

export { canWriteCosts, canWriteItemCosts, formatIsoDay, todayIso } from '@/components/admin/CostSheets/cost-utils';

/** Mês `''` = ano inteiro; `custom` = datas livres. */
export type MonthChoice = '' | 'custom' | `${number}`;

export interface Period {
    from: string;
    to: string;
    groupBy: 'day' | 'month';
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Ano + mês viram um período fechado. Um mês é agrupado por dia; o ano ou
 * um intervalo maior que dois meses, por mês.
 */
export function resolvePeriod(year: number, month: MonthChoice, customFrom: string, customTo: string): Period | null {
    if (month === 'custom') {
        if (!customFrom || !customTo || customFrom > customTo) return null;
        const days = (Date.parse(customTo) - Date.parse(customFrom)) / 86_400_000;
        return { from: customFrom, to: customTo, groupBy: days > 62 ? 'month' : 'day' };
    }
    if (month === '') return { from: `${year}-01-01`, to: `${year}-12-31`, groupBy: 'month' };
    const monthNumber = Number(month);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
        from: `${year}-${pad(monthNumber)}-01`,
        to: `${year}-${pad(monthNumber)}-${pad(lastDay)}`,
        groupBy: 'day',
    };
}

/** Rótulo do balde do gráfico: `2026-10` → `out/26`, `2026-10-06` → `06/10`. */
export function bucketLabel(bucket: string, locale: string): string {
    const [year, month, day] = bucket.split('-').map(Number);
    if (day) return `${pad(day)}/${pad(month)}`;
    return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1));
}

/** Lucro ÷ receita em pontos-base → "34,5%". */
export function formatMargin(basisPoints: number | null): string {
    if (basisPoints === null) return '—';
    return `${(basisPoints / 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Busca todas as páginas de uma listagem (exportação e relatório). */
export async function fetchAllPages<T>(path: string, params: URLSearchParams, limit = 500): Promise<T[]> {
    const rows: T[] = [];
    for (let page = 1; ; page += 1) {
        params.set('page', String(page));
        params.set('limit', String(limit));
        const result = await api<Page<T>>(`${path}?${params.toString()}`);
        rows.push(...result.data);
        if (rows.length >= result.total || result.data.length === 0) return rows;
    }
}

/** Centavos/fen → "123,45" (planilha em pt-BR, sem símbolo de moeda). */
export function minorToDecimal(minor: string | number): string {
    const value = BigInt(minor);
    const zero = BigInt(0);
    const hundred = BigInt(100);
    const negative = value < zero;
    const abs = negative ? -value : value;
    const units = abs / hundred;
    const cents = (abs % hundred).toString().padStart(2, '0');
    return `${negative ? '-' : ''}${units},${cents}`;
}

/**
 * CSV com `;` e BOM: abre direto no Excel em português sem trocar vírgula
 * decimal por separador de coluna.
 */
export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null>>) {
    const escape = (cell: string | number | null) => {
        const text = cell === null ? '' : String(cell);
        return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const content = [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');
    const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
