'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Percent, Plus, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import {
    CostEntriesTable,
    CostEntryDialog,
    OrderCostSheetDialog,
    PackageCostSheetDialog,
    useCostPresets,
} from '@/components/admin/CostSheets';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatCard } from '@/components/admin/StatCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { SummaryList } from '@/components/admin/SummaryList';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import {
    brl,
    cny,
    COST_CATEGORIES,
    formatDate,
    money,
    orderStatusLabel,
    packageStatusLabel,
    type CostEntry,
    type CostEntryPage,
    type CostPreset,
    type Page,
    type ProfitOrderRow,
    type ProfitPackageRow,
    type ProfitSummary,
} from '@/types/api';
import { CostPresetDialog } from './CostPresetDialog';
import { ProfitChart } from './ProfitChart';
import {
    canWriteCosts,
    downloadCsv,
    fetchAllPages,
    formatIsoDay,
    formatMargin,
    minorToDecimal,
    resolvePeriod,
    type MonthChoice,
    type Period,
} from './profit-shared';

type Tab = 'orders' | 'packages' | 'entries' | 'presets';
const LIMIT = 20;
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;

/**
 * Custos e lucro: o dashboard do período, a planilha por pedido e por caixa
 * e os lançamentos de custo. Tudo em yuan — a moeda em que a carteira e o
 * catálogo contam; o equivalente em reais aparece pela cotação de hoje.
 */
export function ProfitPage() {
    const { t, locale } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const canWrite = canWriteCosts(admin?.role);
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState<MonthChoice>(String(new Date().getMonth() + 1).padStart(2, '0') as MonthChoice);
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [tab, setTab] = useState<Tab>('orders');
    const [version, setVersion] = useState(0);
    const [summary, setSummary] = useState<{ key: string; data: ProfitSummary }>();
    const [failure, setFailure] = useState<{ key: string; message: string }>();
    const [creating, setCreating] = useState(false);
    const [presetsVersion, setPresetsVersion] = useState(0);
    const presets = useCostPresets(true, presetsVersion);

    const period = resolvePeriod(year, month, customFrom, customTo);
    const periodKey = period ? `${period.from}|${period.to}|${period.groupBy}|${version}` : '';
    const data = summary?.key === periodKey ? summary.data : undefined;
    const error = failure?.key === periodKey ? failure.message : undefined;

    useEffect(() => {
        if (!period) return;
        let active = true;
        const key = `${period.from}|${period.to}|${period.groupBy}|${version}`;
        const query = new URLSearchParams({ from: period.from, to: period.to, groupBy: period.groupBy });
        api<ProfitSummary>(`/costs/report/summary?${query.toString()}`)
            .then((result) => {
                if (active) setSummary({ key, data: result });
            })
            .catch((err) => {
                if (active) setFailure({ key, message: err instanceof ApiError ? err.message : t('profit.error') });
            });
        return () => {
            active = false;
        };
        // `period` é derivado; as primitivas abaixo são a dependência real.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period?.from, period?.to, period?.groupBy, version, t]);

    const reload = useCallback(() => setVersion((value) => value + 1), []);

    const years = Array.from({ length: 5 }, (_, index) => currentYear - index);
    const monthName = (value: string) =>
        new Intl.DateTimeFormat(locale === 'zh-Hans' ? 'zh-CN' : 'pt-BR', { month: 'long' }).format(
            new Date(2026, Number(value) - 1, 1),
        );
    const reportHref = period ? `/impressao/lucro?from=${period.from}&to=${period.to}` : undefined;
    const profit = data ? Number(data.profitMinor) : 0;

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={
                    <>
                        {reportHref && (
                            <ButtonLink
                                href={reportHref}
                                leadingIcon={<FileText className="h-4 w-4" aria-hidden="true" />}
                                target="_blank"
                                variant="secondary"
                            >
                                {t('profit.actions.report')}
                            </ButtonLink>
                        )}
                        {canWrite && (
                            <Button
                                leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setCreating(true)}
                            >
                                {t('profit.actions.addCost')}
                            </Button>
                        )}
                    </>
                }
                description={t('profit.description')}
                kicker={t('profit.kicker')}
                title={t('profit.title')}
            />

            <SectionCard dense>
                <div className="flex flex-wrap items-end gap-3">
                    <Select
                        fieldClassName="w-28"
                        label={t('profit.period.year')}
                        onChange={(event) => setYear(Number(event.target.value))}
                        options={years.map((value) => ({ value: String(value), label: String(value) }))}
                        disabled={month === 'custom'}
                        value={String(year)}
                    />
                    <Select
                        fieldClassName="w-48"
                        label={t('profit.period.month')}
                        onChange={(event) => setMonth(event.target.value as MonthChoice)}
                        options={[
                            { value: '', label: t('profit.period.wholeYear') },
                            ...MONTHS.map((value) => ({ value, label: monthName(value) })),
                            { value: 'custom', label: t('profit.period.custom') },
                        ]}
                        value={month}
                    />
                    {month === 'custom' && (
                        <>
                            <Input
                                fieldClassName="w-40"
                                label={t('profit.period.from')}
                                onChange={(event) => setCustomFrom(event.target.value)}
                                type="date"
                                value={customFrom}
                            />
                            <Input
                                fieldClassName="w-40"
                                label={t('profit.period.to')}
                                onChange={(event) => setCustomTo(event.target.value)}
                                type="date"
                                value={customTo}
                            />
                        </>
                    )}
                    {period && (
                        <p className="m-0 pb-2 text-xs text-muted dark:text-night-muted">
                            {t('profit.period.range', { from: formatIsoDay(period.from), to: formatIsoDay(period.to) })}
                        </p>
                    )}
                </div>
            </SectionCard>

            {!period && (
                <Alert tone="warning" title={t('profit.period.invalidTitle')}>
                    <p>{t('profit.period.invalid')}</p>
                </Alert>
            )}

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    hint={data ? equivalentBrl(data.revenue.totalMinor, data.currentCnyToBrlRate) : undefined}
                    icon={Receipt}
                    label={t('profit.kpi.revenue')}
                    loading={!data && !error}
                    value={data ? cny(data.revenue.totalMinor) : '—'}
                />
                <StatCard
                    hint={data ? equivalentBrl(data.costs.totalMinor, data.currentCnyToBrlRate) : undefined}
                    icon={Wallet}
                    label={t('profit.kpi.costs')}
                    loading={!data && !error}
                    value={data ? cny(data.costs.totalMinor) : '—'}
                />
                <StatCard
                    hint={data ? equivalentBrl(data.profitMinor, data.currentCnyToBrlRate) : undefined}
                    icon={profit >= 0 ? TrendingUp : TrendingDown}
                    label={profit >= 0 ? t('profit.kpi.profit') : t('profit.kpi.loss')}
                    loading={!data && !error}
                    tone={!data ? 'neutral' : profit >= 0 ? 'success' : 'danger'}
                    value={data ? cny(data.profitMinor) : '—'}
                />
                <StatCard
                    hint={
                        data
                            ? t('profit.kpi.countsHint', { orders: data.counts.orders, packages: data.counts.packages })
                            : undefined
                    }
                    icon={Percent}
                    label={t('profit.kpi.margin')}
                    loading={!data && !error}
                    value={data ? formatMargin(data.marginBasisPoints) : '—'}
                />
            </div>

            {data && data.counts.itemsMissingCost > 0 && (
                <Alert
                    tone="warning"
                    title={t('profit.missingCost.title', { count: data.counts.itemsMissingCost })}
                    action={
                        <ButtonLink href="/admin/produtos" size="small" variant="secondary">
                            {t('profit.missingCost.action')}
                        </ButtonLink>
                    }
                >
                    <p>{t('profit.missingCost.description')}</p>
                </Alert>
            )}

            {data && (
                <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                    <SectionCard description={t('profit.chart.description')} title={t('profit.chart.title')}>
                        <ProfitChart series={data.series} />
                        <PeriodTable series={data.series} />
                    </SectionCard>
                    <div className="grid content-start gap-6">
                        <SectionCard dense title={t('profit.revenue.title')}>
                            <SummaryList rows={revenueRows(data, t)} />
                        </SectionCard>
                        <SectionCard dense title={t('profit.costs.title')}>
                            <SummaryList rows={costRows(data, t)} />
                        </SectionCard>
                    </div>
                </div>
            )}

            {period && (
                <SectionCard flush>
                    <Toolbar>
                        <FilterTabs<Tab>
                            label={t('profit.tabs.label')}
                            onChange={setTab}
                            options={[
                                { value: 'orders', label: t('profit.tabs.orders'), count: data?.counts.orders },
                                { value: 'packages', label: t('profit.tabs.packages'), count: data?.counts.packages },
                                { value: 'entries', label: t('profit.tabs.entries'), count: data?.counts.costEntries },
                                { value: 'presets', label: t('profit.tabs.presets') },
                            ]}
                            value={tab}
                        />
                    </Toolbar>
                    {tab === 'orders' && <OrdersTab onChanged={reload} period={period} version={version} />}
                    {tab === 'packages' && <PackagesTab onChanged={reload} period={period} version={version} />}
                    {tab === 'entries' && (
                        <EntriesTab
                            canWrite={canWrite}
                            onChanged={reload}
                            period={period}
                            presets={presets}
                            version={version}
                        />
                    )}
                    {tab === 'presets' && (
                        <PresetsTab
                            canWrite={canWrite}
                            onChanged={() => setPresetsVersion((value) => value + 1)}
                            presets={presets}
                        />
                    )}
                </SectionCard>
            )}

            <CostEntryDialog
                onClose={() => setCreating(false)}
                onSaved={() => {
                    setCreating(false);
                    reload();
                }}
                open={creating}
                presets={presets}
            />
        </div>
    );
}

type T = ReturnType<typeof useTranslation>['t'];

function equivalentBrl(cnyMinor: string, rate: string | null): string | undefined {
    if (!rate) return undefined;
    return `≈ ${brl(Math.round(Number(cnyMinor) * Number(rate)))}`;
}

function revenueRows(data: ProfitSummary, t: T) {
    return [
        { label: t('profit.revenue.merchandise'), value: cny(data.revenue.merchandiseMinor) },
        { label: t('profit.revenue.serviceFee'), value: cny(data.revenue.serviceFeeMinor) },
        { label: t('profit.revenue.optionalServices'), value: cny(data.revenue.optionalServicesMinor) },
        { label: t('profit.revenue.shipping'), value: cny(data.revenue.shippingMinor) },
        { label: t('profit.revenue.storage'), value: cny(data.revenue.storageMinor) },
        {
            label: t('profit.revenue.fxSpread'),
            value:
                data.fxSpreadBrlMinor !== '0'
                    ? `${cny(data.revenue.fxSpreadMinor)} (${brl(data.fxSpreadBrlMinor)})`
                    : cny(data.revenue.fxSpreadMinor),
        },
        { label: t('profit.revenue.discounts'), value: `− ${cny(data.revenue.discountsMinor)}` },
        { label: t('profit.revenue.total'), value: cny(data.revenue.totalMinor), emphasis: true },
    ];
}

function costRows(data: ProfitSummary, t: T) {
    return [
        { label: t('profit.costs.products'), value: cny(data.costs.productsMinor) },
        { label: t('profit.costs.freight'), value: cny(data.costs.freightMinor) },
        ...COST_CATEGORIES.filter((category) => data.costs.entriesByCategory[category]).map((category) => ({
            label: t(`profit.categories.${category}`),
            value: cny(data.costs.entriesByCategory[category] ?? '0'),
        })),
        { label: t('profit.costs.total'), value: cny(data.costs.totalMinor), emphasis: true },
    ];
}

/** A mesma série do gráfico, em tabela — leitura exata e acessível. */
function PeriodTable({ series }: { series: ProfitSummary['series'] }) {
    const { t } = useTranslation();
    if (series.length === 0) return null;
    return (
        <details className="mt-4">
            <summary className="cursor-pointer text-xs font-semibold text-primary dark:text-night-accent">
                {t('profit.chart.showTable')}
            </summary>
            <table className="mt-2 w-full text-xs">
                <thead>
                    <tr className="text-left text-muted dark:text-night-muted">
                        <th className="py-1 font-semibold">{t('profit.chart.period')}</th>
                        <th className="py-1 text-right font-semibold">{t('profit.chart.revenue')}</th>
                        <th className="py-1 text-right font-semibold">{t('profit.chart.costs')}</th>
                        <th className="py-1 text-right font-semibold">{t('profit.chart.profit')}</th>
                    </tr>
                </thead>
                <tbody>
                    {series.map((point) => (
                        <tr className="border-t border-line dark:border-night-line" key={point.bucket}>
                            <td className="py-1">{formatIsoDay(point.bucket)}</td>
                            <td className="mm-data py-1 text-right">{cny(point.revenueMinor)}</td>
                            <td className="mm-data py-1 text-right">{cny(point.costsMinor)}</td>
                            <td className="mm-data py-1 text-right font-semibold">{cny(point.profitMinor)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </details>
    );
}

function ProfitValue({ minor }: { minor: string }) {
    const negative = Number(minor) < 0;
    return (
        <span className={`mm-data font-semibold ${negative ? 'text-origin-700 dark:text-night-coral' : ''}`}>
            {cny(minor)}
        </span>
    );
}

/** Carrega uma página de `path` para o período; recarrega quando `version` muda. */
function usePeriodPage<Row>(path: string, period: Period, version: number, pageNumber: number) {
    const [loaded, setLoaded] = useState<{ key: string; page: Page<Row> }>();
    const [failure, setFailure] = useState<{ key: string; message: string }>();
    const key = `${path}|${period.from}|${period.to}|${version}|${pageNumber}`;
    useEffect(() => {
        let active = true;
        const query = new URLSearchParams({
            from: period.from,
            to: period.to,
            page: String(pageNumber),
            limit: String(LIMIT),
        });
        api<Page<Row>>(`${path}?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch((err) => {
                if (active) setFailure({ key, message: err instanceof ApiError ? err.message : 'error' });
            });
        return () => {
            active = false;
        };
    }, [key, path, period.from, period.to, pageNumber]);
    return {
        page: loaded?.key === key ? loaded.page : undefined,
        error: failure?.key === key ? failure.message : undefined,
    };
}

function TabPagination({
    page,
    pageNumber,
    onChange,
    loading,
}: {
    page?: Page<unknown>;
    pageNumber: number;
    onChange: (page: number) => void;
    loading: boolean;
}) {
    const { t } = useTranslation();
    if (!page || page.data.length === 0) return null;
    const totalPages = Math.max(1, Math.ceil(page.total / page.limit));
    return (
        <Pagination
            disabled={loading}
            nextLabel={t('common.pagination.next')}
            onChange={onChange}
            page={pageNumber}
            previousLabel={t('common.pagination.previous')}
            summary={t('common.pagination.page', { page: pageNumber, total: totalPages })}
            totalPages={totalPages}
        />
    );
}

function ExportButton({ onExport }: { onExport: () => Promise<void> }) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [busy, setBusy] = useState(false);
    return (
        <Button
            leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            loading={busy}
            onClick={async () => {
                setBusy(true);
                try {
                    await onExport();
                } catch {
                    notify({ tone: 'danger', title: t('profit.exportError') });
                } finally {
                    setBusy(false);
                }
            }}
            size="small"
            variant="secondary"
        >
            {t('profit.actions.exportCsv')}
        </Button>
    );
}

function OrdersTab({ period, version, onChanged }: { period: Period; version: number; onChanged: () => void }) {
    const { t } = useTranslation();
    const [pageNumber, setPageNumber] = useState(1);
    const [openId, setOpenId] = useState<string | null>(null);
    const { page, error } = usePeriodPage<ProfitOrderRow>('/costs/report/orders', period, version, pageNumber);

    const columns: DataTableColumn<ProfitOrderRow>[] = [
        {
            key: 'order',
            header: t('profit.orders.order'),
            cell: (row) => (
                <span className="block min-w-0">
                    <button
                        className="mm-data cursor-pointer bg-transparent p-0 text-sm font-semibold text-primary hover:underline dark:text-night-accent"
                        onClick={() => setOpenId(row.orderId)}
                        type="button"
                    >
                        #{row.orderId.slice(0, 8)}
                    </button>
                    <span className="mt-0.5 block truncate text-xs text-muted dark:text-night-muted">
                        {row.itemsSummary}
                    </span>
                </span>
            ),
        },
        {
            key: 'customer',
            header: t('profit.orders.customer'),
            hideBelow: 'lg',
            cell: (row) => (
                <span className="block text-xs">
                    <span className="block">{row.customerName ?? '—'}</span>
                    <span className="block text-muted dark:text-night-muted">
                        {formatDate(row.paidAt)} · {orderStatusLabel(row.status)}
                    </span>
                </span>
            ),
        },
        { key: 'revenue', header: t('profit.orders.revenue'), numeric: true, cell: (row) => cny(row.revenueMinor) },
        {
            key: 'cost',
            header: t('profit.orders.cost'),
            numeric: true,
            cell: (row) => (
                <span className="block">
                    <span className="mm-data">
                        {cny(BigInt(row.productCostMinor) + BigInt(row.entriesCostMinor) + '')}
                    </span>
                    {row.itemsMissingCost > 0 && (
                        <span className="mt-0.5 block">
                            <StatusPill tone="warning">
                                {t('profit.orders.missing', { count: row.itemsMissingCost })}
                            </StatusPill>
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'profit',
            header: t('profit.orders.profit'),
            numeric: true,
            cell: (row) => <ProfitValue minor={row.profitMinor} />,
        },
        {
            key: 'actions',
            header: '',
            card: 'full',
            cell: (row) => (
                <Button onClick={() => setOpenId(row.orderId)} size="small" variant="ghost">
                    {t('profit.actions.openSheet')}
                </Button>
            ),
        },
    ];

    async function exportCsv() {
        const rows = await fetchAllPages<ProfitOrderRow>(
            '/costs/report/orders',
            new URLSearchParams({ from: period.from, to: period.to }),
        );
        downloadCsv(
            `lucro-pedidos-${period.from}-a-${period.to}.csv`,
            [
                'Pedido',
                'Pago em',
                'Status',
                'Cliente',
                'Itens',
                'Receita (¥)',
                'Custo produtos (¥)',
                'Outros custos (¥)',
                'Lucro (¥)',
                'Itens sem custo',
            ],
            rows.map((row) => [
                row.orderId,
                formatDate(row.paidAt),
                orderStatusLabel(row.status),
                row.customerName,
                row.itemsSummary,
                minorToDecimal(row.revenueMinor),
                minorToDecimal(row.productCostMinor),
                minorToDecimal(row.entriesCostMinor),
                minorToDecimal(row.profitMinor),
                row.itemsMissingCost,
            ]),
        );
    }

    return (
        <>
            <Toolbar actions={<ExportButton onExport={exportCsv} />}>
                <p className="m-0 text-xs text-muted dark:text-night-muted">{t('profit.orders.hint')}</p>
            </Toolbar>
            {error && <p className="px-4 text-sm text-origin-700">{t('profit.error')}</p>}
            <DataTable
                caption={t('profit.tabs.orders')}
                columns={columns}
                empty={<p className="py-8 text-center text-sm text-muted">{t('profit.orders.empty')}</p>}
                loading={!page && !error}
                loadingLabel={t('common.loading')}
                minWidth="48rem"
                rowKey={(row) => row.orderId}
                rows={page?.data ?? []}
            />
            <TabPagination loading={!page} onChange={setPageNumber} page={page} pageNumber={pageNumber} />
            <OrderCostSheetDialog onChanged={onChanged} onClose={() => setOpenId(null)} orderId={openId} />
        </>
    );
}

function PackagesTab({ period, version, onChanged }: { period: Period; version: number; onChanged: () => void }) {
    const { t } = useTranslation();
    const [pageNumber, setPageNumber] = useState(1);
    const [openId, setOpenId] = useState<string | null>(null);
    const { page, error } = usePeriodPage<ProfitPackageRow>('/costs/report/packages', period, version, pageNumber);

    const columns: DataTableColumn<ProfitPackageRow>[] = [
        {
            key: 'box',
            header: t('profit.packages.box'),
            cell: (row) => (
                <span className="block">
                    <button
                        className="mm-data cursor-pointer bg-transparent p-0 text-sm font-semibold text-primary hover:underline dark:text-night-accent"
                        onClick={() => setOpenId(row.packageId)}
                        type="button"
                    >
                        {row.packageCode}
                    </button>
                    <span className="mt-0.5 block text-xs text-muted dark:text-night-muted">
                        {formatDate(row.paidAt)} · {packageStatusLabel(row.status)}
                    </span>
                </span>
            ),
        },
        {
            key: 'customer',
            header: t('profit.orders.customer'),
            hideBelow: 'lg',
            cell: (row) => <span className="text-xs">{row.customerName ?? '—'}</span>,
        },
        { key: 'revenue', header: t('profit.packages.revenue'), numeric: true, cell: (row) => cny(row.revenueMinor) },
        {
            key: 'freight',
            header: t('profit.packages.freight'),
            numeric: true,
            cell: (row) => cny(row.freightCostMinor),
        },
        {
            key: 'packaging',
            header: t('profit.packages.packaging'),
            numeric: true,
            cell: (row) =>
                row.entriesCostMinor === '0' ? (
                    <StatusPill tone="neutral">{t('profit.packages.noPackaging')}</StatusPill>
                ) : (
                    cny(row.entriesCostMinor)
                ),
        },
        {
            key: 'profit',
            header: t('profit.orders.profit'),
            numeric: true,
            cell: (row) => <ProfitValue minor={row.profitMinor} />,
        },
        {
            key: 'actions',
            header: '',
            card: 'full',
            cell: (row) => (
                <Button onClick={() => setOpenId(row.packageId)} size="small" variant="ghost">
                    {t('profit.actions.openSheet')}
                </Button>
            ),
        },
    ];

    async function exportCsv() {
        const rows = await fetchAllPages<ProfitPackageRow>(
            '/costs/report/packages',
            new URLSearchParams({ from: period.from, to: period.to }),
        );
        downloadCsv(
            `lucro-caixas-${period.from}-a-${period.to}.csv`,
            [
                'Caixa',
                'Pago em',
                'Status',
                'Cliente',
                'Receita (¥)',
                'Frete pago (¥)',
                'Embalagem e outros (¥)',
                'Lucro (¥)',
            ],
            rows.map((row) => [
                row.packageCode,
                formatDate(row.paidAt),
                packageStatusLabel(row.status),
                row.customerName,
                minorToDecimal(row.revenueMinor),
                minorToDecimal(row.freightCostMinor),
                minorToDecimal(row.entriesCostMinor),
                minorToDecimal(row.profitMinor),
            ]),
        );
    }

    return (
        <>
            <Toolbar actions={<ExportButton onExport={exportCsv} />}>
                <p className="m-0 text-xs text-muted dark:text-night-muted">{t('profit.packages.hint')}</p>
            </Toolbar>
            {error && <p className="px-4 text-sm text-origin-700">{t('profit.error')}</p>}
            <DataTable
                caption={t('profit.tabs.packages')}
                columns={columns}
                empty={<p className="py-8 text-center text-sm text-muted">{t('profit.packages.empty')}</p>}
                loading={!page && !error}
                loadingLabel={t('common.loading')}
                minWidth="48rem"
                rowKey={(row) => row.packageId}
                rows={page?.data ?? []}
            />
            <TabPagination loading={!page} onChange={setPageNumber} page={page} pageNumber={pageNumber} />
            <PackageCostSheetDialog onChanged={onChanged} onClose={() => setOpenId(null)} packageId={openId} />
        </>
    );
}

function EntriesTab({
    period,
    version,
    canWrite,
    presets,
    onChanged,
}: {
    period: Period;
    version: number;
    canWrite: boolean;
    presets: readonly CostPreset[];
    onChanged: () => void;
}) {
    const { t } = useTranslation();
    const [pageNumber, setPageNumber] = useState(1);
    const [category, setCategory] = useState('');
    const [scope, setScope] = useState('');
    const [editing, setEditing] = useState<CostEntry>();
    const [loaded, setLoaded] = useState<{ key: string; page: CostEntryPage }>();
    const key = `${period.from}|${period.to}|${version}|${pageNumber}|${category}|${scope}`;
    const page = loaded?.key === key ? loaded.page : undefined;

    const query = useCallback(() => {
        const params = new URLSearchParams({ from: period.from, to: period.to });
        if (category) params.set('category', category);
        if (scope) params.set('scope', scope);
        return params;
    }, [period.from, period.to, category, scope]);

    useEffect(() => {
        let active = true;
        const params = query();
        params.set('page', String(pageNumber));
        params.set('limit', String(LIMIT));
        api<CostEntryPage>(`/costs/entries?${params.toString()}`)
            .then((result) => {
                if (active) setLoaded({ key, page: result });
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [key, query, pageNumber]);

    async function exportCsv() {
        const rows = await fetchAllPages<CostEntry>('/costs/entries', query());
        downloadCsv(
            `custos-${period.from}-a-${period.to}.csv`,
            [
                'Data',
                'Categoria',
                'Descrição',
                'Qtd.',
                'Valor unitário',
                'Moeda',
                'Total',
                'Cotação',
                'Total (¥)',
                'Caixa',
                'Pedido',
                'Lançado por',
            ],
            rows.map((row) => [
                formatIsoDay(row.incurredOn),
                t(`profit.categories.${row.category}`),
                row.description,
                row.quantity,
                minorToDecimal(row.unitAmountMinor),
                row.currency,
                minorToDecimal(row.amountMinor),
                row.exchangeRate,
                minorToDecimal(row.amountCnyMinor),
                row.packageCode,
                row.orderId,
                row.createdBy?.name ?? null,
            ]),
        );
    }

    return (
        <>
            <Toolbar actions={<ExportButton onExport={exportCsv} />}>
                <Select
                    fieldClassName="w-48"
                    label={t('profit.entryForm.category')}
                    onChange={(event) => {
                        setCategory(event.target.value);
                        setPageNumber(1);
                    }}
                    options={COST_CATEGORIES.map((value) => ({ value, label: t(`profit.categories.${value}`) }))}
                    placeholderOption={t('profit.entries.allCategories')}
                    value={category}
                />
                <Select
                    fieldClassName="w-44"
                    label={t('profit.entries.scope')}
                    onChange={(event) => {
                        setScope(event.target.value);
                        setPageNumber(1);
                    }}
                    options={[
                        { value: 'GENERAL', label: t('profit.entries.scopes.GENERAL') },
                        { value: 'PACKAGE', label: t('profit.entries.scopes.PACKAGE') },
                        { value: 'ORDER', label: t('profit.entries.scopes.ORDER') },
                    ]}
                    placeholderOption={t('profit.entries.scopes.all')}
                    value={scope}
                />
                {page && (
                    <p className="m-0 pb-2 text-xs text-muted dark:text-night-muted">
                        {t('profit.entries.sum', { total: cny(page.totalCnyMinor), count: page.total })}
                    </p>
                )}
            </Toolbar>
            <div className="px-4 pb-2 sm:px-5">
                {!page ? (
                    <p className="py-6 text-sm text-muted">{t('common.loading')}</p>
                ) : (
                    <CostEntriesTable
                        canWrite={canWrite}
                        entries={page.data}
                        onDeleted={onChanged}
                        onEdit={setEditing}
                        showTarget
                    />
                )}
            </div>
            <TabPagination loading={!page} onChange={setPageNumber} page={page} pageNumber={pageNumber} />
            <CostEntryDialog
                entry={editing}
                onClose={() => setEditing(undefined)}
                onSaved={() => {
                    setEditing(undefined);
                    onChanged();
                }}
                open={editing !== undefined}
                presets={presets}
            />
        </>
    );
}

function PresetsTab({
    presets,
    canWrite,
    onChanged,
}: {
    presets: readonly CostPreset[];
    canWrite: boolean;
    onChanged: () => void;
}) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState<{ preset?: CostPreset } | null>(null);
    return (
        <>
            <Toolbar
                actions={
                    canWrite ? (
                        <Button
                            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setEditing({})}
                            size="small"
                            variant="secondary"
                        >
                            {t('profit.presets.new')}
                        </Button>
                    ) : undefined
                }
            >
                <p className="m-0 text-xs text-muted dark:text-night-muted">{t('profit.presets.hint')}</p>
            </Toolbar>
            <ul className="m-0 grid list-none gap-0 px-4 pb-3 sm:px-5">
                {presets.length === 0 && <li className="py-6 text-sm text-muted">{t('profit.presets.empty')}</li>}
                {presets.map((preset, index) => (
                    <li
                        className={`flex items-center justify-between gap-3 py-2.5 ${index > 0 ? 'border-t border-line dark:border-night-line' : ''}`}
                        key={preset.id}
                    >
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{preset.name}</span>
                            <span className="block text-xs text-muted dark:text-night-muted">
                                {t(`profit.categories.${preset.category}`)}
                            </span>
                        </span>
                        <span className="flex items-center gap-2">
                            {!preset.isActive && <StatusPill tone="neutral">{t('profit.presets.inactive')}</StatusPill>}
                            <span className="mm-data text-sm font-semibold">
                                {money(preset.unitAmountMinor, preset.currency)}
                            </span>
                            {canWrite && (
                                <Button onClick={() => setEditing({ preset })} size="small" variant="ghost">
                                    {t('profit.entries.edit')}
                                </Button>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
            <CostPresetDialog
                onClose={() => setEditing(null)}
                onSaved={() => {
                    setEditing(null);
                    onChanged();
                }}
                open={editing !== null}
                preset={editing?.preset}
            />
        </>
    );
}
