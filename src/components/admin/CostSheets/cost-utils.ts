/** Espelho dos `@Roles` de `AdminCostsController` no backend. */
const COST_WRITER_ROLES = ['WAREHOUSE', 'FINANCE', 'SUPERADMIN'];
const ITEM_COST_WRITER_ROLES = ['CATALOG', 'FINANCE', 'SUPERADMIN'];

export function canWriteCosts(role: string | undefined) {
    return role !== undefined && COST_WRITER_ROLES.includes(role);
}

export function canWriteItemCosts(role: string | undefined) {
    return role !== undefined && ITEM_COST_WRITER_ROLES.includes(role);
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Hoje no fuso do navegador, em `YYYY-MM-DD`. */
export function todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2026-10-06` → `06/10/2026` sem passar por `Date` (que puxaria o fuso). */
export function formatIsoDay(value: string): string {
    const [year, month, day] = value.split('-');
    return day ? `${day}/${month}/${year}` : `${month}/${year}`;
}
