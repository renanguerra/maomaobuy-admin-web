'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, LoaderCircle, Printer } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import {
    COST_CATEGORIES,
    brl,
    cny,
    formatDate,
    orderStatusLabel,
    packageStatusLabel,
    type CostEntry,
    type CostEntryPage,
    type Page,
    type ProfitOrderRow,
    type ProfitPackageRow,
    type ProfitSummary,
} from '@/types/api';
import { formatIsoDay, formatMargin } from '../../admin/lucro/profit-shared';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** O papel aguenta uma lista curta; a planilha completa sai pelo CSV da tela. */
const ROWS_ON_PAPER = 200;

interface ReportData {
    summary: ProfitSummary;
    orders: Page<ProfitOrderRow>;
    packages: Page<ProfitPackageRow>;
    entries: CostEntryPage;
}

/**
 * Relatório do período para imprimir ou salvar em PDF: resumo, série,
 * pedidos, caixas e custos lançados. Papel é sempre fundo branco e tinta
 * escura — cores fixas de propósito, como a folha de montagem.
 */
export function ProfitReportPrintPage() {
    const { t } = useTranslation();
    const params = useSearchParams();
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    const valid = ISO_DAY.test(from) && ISO_DAY.test(to);
    const key = `${from}|${to}`;
    const [loaded, setLoaded] = useState<{ key: string; data: ReportData }>();
    const [failed, setFailed] = useState<string>();
    const [generatedAt] = useState(() => new Date().toISOString());

    useEffect(() => {
        if (!valid) return;
        let active = true;
        const query = (extra: Record<string, string>) => new URLSearchParams({ from, to, ...extra }).toString();
        const groupBy = (Date.parse(to) - Date.parse(from)) / 86_400_000 > 62 ? 'month' : 'day';
        Promise.all([
            api<ProfitSummary>(`/costs/report/summary?${query({ groupBy })}`),
            api<Page<ProfitOrderRow>>(`/costs/report/orders?${query({ limit: String(ROWS_ON_PAPER) })}`),
            api<Page<ProfitPackageRow>>(`/costs/report/packages?${query({ limit: String(ROWS_ON_PAPER) })}`),
            api<CostEntryPage>(`/costs/entries?${query({ limit: String(ROWS_ON_PAPER) })}`),
        ])
            .then(([summary, orders, packages, entries]) => {
                if (active) setLoaded({ key: `${from}|${to}`, data: { summary, orders, packages, entries } });
            })
            .catch(() => {
                if (active) setFailed(`${from}|${to}`);
            });
        return () => {
            active = false;
        };
    }, [from, to, valid]);

    const data = loaded?.key === key ? loaded.data : undefined;
    const error = failed === key;

    useEffect(() => {
        if (valid) document.title = `${t('profit.print.title')} · ${formatIsoDay(from)}–${formatIsoDay(to)}`;
    }, [from, to, valid, t]);

    return (
        <div className="min-h-screen bg-warm-200 text-warm-950 print:bg-white">
            <header className="sticky top-0 z-10 border-b border-warm-300 bg-warm-50/95 backdrop-blur print:hidden">
                <div className="mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <ButtonLink
                        href="/admin/lucro"
                        leadingIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
                        size="small"
                        variant="ghost"
                    >
                        {t('profit.print.back')}
                    </ButtonLink>
                    <Button
                        disabled={!data}
                        leadingIcon={<Printer className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => window.print()}
                        size="small"
                    >
                        {t('profit.print.print')}
                    </Button>
                </div>
            </header>

            <main className="mx-auto w-full max-w-[210mm] px-4 py-6 print:max-w-none print:p-0">
                {!valid && (
                    <Alert tone="warning" title={t('profit.print.title')}>
                        <p>{t('profit.print.missingPeriod')}</p>
                    </Alert>
                )}
                {error && (
                    <Alert tone="danger" title={t('common.errors.loadTitle')}>
                        <p>{t('profit.error')}</p>
                    </Alert>
                )}
                {valid && !data && !error && (
                    <p className="flex items-center gap-3 py-16 text-sm font-semibold text-warm-600" aria-busy="true">
                        <LoaderCircle className="h-5 w-5 animate-spin text-brand-700" aria-hidden="true" />
                        {t('profit.print.loading')}
                    </p>
                )}
                {data && <Report data={data} from={from} generatedAt={generatedAt} to={to} />}
            </main>
        </div>
    );
}

function Report({ data, from, to, generatedAt }: { data: ReportData; from: string; to: string; generatedAt: string }) {
    const { t } = useTranslation();
    const { summary, orders, packages, entries } = data;
    const profit = Number(summary.profitMinor);

    return (
        <article className="grid gap-6 rounded-lg border border-warm-300 bg-warm-50 p-[12mm] text-[11px] leading-snug shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <header className="border-b-2 border-warm-950 pb-3">
                <span className="block text-[10px] font-bold tracking-[.08em] text-warm-600 uppercase">MaoMaoBuy</span>
                <h1 className="mm-display m-0 mt-1 text-2xl leading-none">{t('profit.print.title')}</h1>
                <p className="m-0 mt-1.5 text-xs text-warm-700">
                    {t('profit.period.range', { from: formatIsoDay(from), to: formatIsoDay(to) })} ·{' '}
                    {t('profit.print.generatedAt', { date: formatDate(generatedAt) })}
                </p>
            </header>

            <section className="grid grid-cols-4 gap-3">
                <Kpi label={t('profit.kpi.revenue')} value={cny(summary.revenue.totalMinor)} />
                <Kpi label={t('profit.kpi.costs')} value={cny(summary.costs.totalMinor)} />
                <Kpi
                    label={profit >= 0 ? t('profit.kpi.profit') : t('profit.kpi.loss')}
                    value={cny(summary.profitMinor)}
                    strong
                />
                <Kpi label={t('profit.kpi.margin')} value={formatMargin(summary.marginBasisPoints)} />
            </section>

            {summary.counts.itemsMissingCost > 0 && (
                <p className="m-0 rounded border border-warm-400 p-2 font-semibold">
                    {t('profit.missingCost.title', { count: summary.counts.itemsMissingCost })} —{' '}
                    <span className="font-normal">{t('profit.missingCost.description')}</span>
                </p>
            )}

            <section className="grid grid-cols-2 gap-6">
                <Block title={t('profit.revenue.title')}>
                    <Lines
                        rows={[
                            [t('profit.revenue.merchandise'), cny(summary.revenue.merchandiseMinor)],
                            [t('profit.revenue.serviceFee'), cny(summary.revenue.serviceFeeMinor)],
                            [t('profit.revenue.optionalServices'), cny(summary.revenue.optionalServicesMinor)],
                            [t('profit.revenue.shipping'), cny(summary.revenue.shippingMinor)],
                            [t('profit.revenue.storage'), cny(summary.revenue.storageMinor)],
                            [t('profit.revenue.fxSpread'), cny(summary.revenue.fxSpreadMinor)],
                            [t('profit.revenue.discounts'), `− ${cny(summary.revenue.discountsMinor)}`],
                        ]}
                        total={[t('profit.revenue.total'), cny(summary.revenue.totalMinor)]}
                    />
                </Block>
                <Block title={t('profit.costs.title')}>
                    <Lines
                        rows={[
                            [t('profit.costs.products'), cny(summary.costs.productsMinor)],
                            [t('profit.costs.freight'), cny(summary.costs.freightMinor)],
                            ...COST_CATEGORIES.filter((category) => summary.costs.entriesByCategory[category]).map(
                                (category): [string, string] => [
                                    t(`profit.categories.${category}`),
                                    cny(summary.costs.entriesByCategory[category] ?? '0'),
                                ],
                            ),
                        ]}
                        total={[t('profit.costs.total'), cny(summary.costs.totalMinor)]}
                    />
                </Block>
            </section>

            {summary.currentCnyToBrlRate && (
                <p className="m-0 text-warm-700">
                    {t('profit.print.rate', { rate: Number(summary.currentCnyToBrlRate).toFixed(4).replace('.', ',') })}{' '}
                    {t('profit.kpi.profit')}: ≈ {brl(Math.round(profit * Number(summary.currentCnyToBrlRate)))}
                </p>
            )}

            {summary.series.length > 0 && (
                <Block title={t('profit.print.byPeriod')}>
                    <Table
                        head={[
                            t('profit.chart.period'),
                            t('profit.chart.revenue'),
                            t('profit.chart.costs'),
                            t('profit.chart.profit'),
                        ]}
                        numericFrom={1}
                        rows={summary.series.map((point) => [
                            formatIsoDay(point.bucket),
                            cny(point.revenueMinor),
                            cny(point.costsMinor),
                            cny(point.profitMinor),
                        ])}
                    />
                </Block>
            )}

            <Block title={`${t('profit.print.topOrders')} (${orders.total})`}>
                <Table
                    head={[
                        t('profit.orders.order'),
                        t('profit.orders.customer'),
                        t('profit.orders.revenue'),
                        t('profit.orders.cost'),
                        t('profit.orders.profit'),
                    ]}
                    numericFrom={2}
                    rows={orders.data.map((row) => [
                        `#${row.orderId.slice(0, 8)} · ${row.itemsSummary}${row.itemsMissingCost ? ' *' : ''}`,
                        `${row.customerName ?? '—'} · ${formatDate(row.paidAt)} · ${orderStatusLabel(row.status)}`,
                        cny(row.revenueMinor),
                        cny((BigInt(row.productCostMinor) + BigInt(row.entriesCostMinor)).toString()),
                        cny(row.profitMinor),
                    ])}
                />
                <Truncated shown={orders.data.length} total={orders.total} />
            </Block>

            <Block title={`${t('profit.print.boxes')} (${packages.total})`}>
                <Table
                    head={[
                        t('profit.packages.box'),
                        t('profit.packages.revenue'),
                        t('profit.packages.freight'),
                        t('profit.packages.packaging'),
                        t('profit.orders.profit'),
                    ]}
                    numericFrom={1}
                    rows={packages.data.map((row) => [
                        `${row.packageCode} · ${formatDate(row.paidAt)} · ${packageStatusLabel(row.status)}`,
                        cny(row.revenueMinor),
                        cny(row.freightCostMinor),
                        cny(row.entriesCostMinor),
                        cny(row.profitMinor),
                    ])}
                />
                <Truncated shown={packages.data.length} total={packages.total} />
            </Block>

            <Block title={`${t('profit.print.entries')} (${entries.total} · ${cny(entries.totalCnyMinor)})`}>
                <Table
                    head={[
                        t('profit.entryForm.incurredOn'),
                        t('profit.entryForm.category'),
                        t('profit.entryForm.description'),
                        '¥',
                    ]}
                    numericFrom={3}
                    rows={entries.data.map((entry: CostEntry) => [
                        formatIsoDay(entry.incurredOn),
                        t(`profit.categories.${entry.category}`),
                        `${entry.quantity > 1 ? `${entry.quantity} × ` : ''}${entry.description}${entry.packageCode ? ` (${entry.packageCode})` : ''}`,
                        cny(entry.amountCnyMinor),
                    ])}
                />
                <Truncated shown={entries.data.length} total={entries.total} />
            </Block>
        </article>
    );
}

function Kpi({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className={`rounded border p-2 ${strong ? 'border-warm-950' : 'border-warm-400'}`}>
            <span className="block text-[10px] font-bold text-warm-600 uppercase">{label}</span>
            <span className="mm-data mt-1 block text-base font-bold">{value}</span>
        </div>
    );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="break-inside-avoid-page">
            <h2 className="m-0 mb-1.5 border-b border-warm-400 pb-1 text-xs font-bold uppercase">{title}</h2>
            {children}
        </section>
    );
}

function Lines({ rows, total }: { rows: Array<[string, string]>; total: [string, string] }) {
    return (
        <dl className="m-0">
            {rows.map(([label, value]) => (
                <div className="flex justify-between gap-3 py-0.5" key={label}>
                    <dt>{label}</dt>
                    <dd className="mm-data m-0">{value}</dd>
                </div>
            ))}
            <div className="mt-1 flex justify-between gap-3 border-t border-warm-950 pt-1 font-bold">
                <dt>{total[0]}</dt>
                <dd className="mm-data m-0">{total[1]}</dd>
            </div>
        </dl>
    );
}

function Table({ head, rows, numericFrom }: { head: string[]; rows: string[][]; numericFrom: number }) {
    return (
        <table className="w-full border-collapse">
            <thead>
                <tr>
                    {head.map((cell, index) => (
                        <th
                            className={`py-1 font-bold ${index >= numericFrom ? 'text-right' : 'text-left'}`}
                            key={cell}
                        >
                            {cell}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, rowIndex) => (
                    <tr className="border-t border-warm-300 break-inside-avoid" key={rowIndex}>
                        {row.map((cell, index) => (
                            <td
                                className={`py-1 align-top ${index >= numericFrom ? 'mm-data text-right whitespace-nowrap' : ''}`}
                                key={index}
                            >
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function Truncated({ shown, total }: { shown: number; total: number }) {
    const { t } = useTranslation();
    if (shown >= total) return null;
    return <p className="m-0 mt-1 text-warm-600">{t('profit.print.truncated', { shown, total })}</p>;
}
