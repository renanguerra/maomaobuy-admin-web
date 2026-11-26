'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Boxes, ClipboardList, FilterX, X } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { CopyButton } from '@/components/admin/CopyButton';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PackagesTabs } from '@/components/admin/PackagesTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { packageStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { AgeBadge } from '@/components/admin/AgeBadge';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { queueStage, usePendingCounts } from '@/services/admin/pending-counts';
import { PACKAGE_QUEUE_TABS, isQueueTab, type PackageQueueTab } from '@/services/admin/work-queues';
import { api } from '@/services/api';
import {
    PACKAGE_STATUSES,
    formatDate,
    packageStatusLabel,
    totalUnits,
    type AdminPackage,
    type Page,
    type WorkQueueStageKey,
} from '@/types/api';

const LIMIT = 20;

interface LoadedPage {
    /** Identifica a consulta que produziu estes dados (página + status). */
    key: string;
    page: Page<AdminPackage>;
}

interface Failure {
    key: string;
    message: string;
}

export function PackagesListPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Tudo que filtra vive na URL: o cartão do painel já chega filtrado e o
    // admin pode mandar a mesma visão para um colega.
    const fila = searchParams.get('fila');
    const tab: PackageQueueTab = isQueueTab(PACKAGE_QUEUE_TABS, fila) ? fila : 'all';
    // `status` aceita vários, separados por vírgula ("Ver fila" do painel).
    const status = searchParams.get('status') ?? '';
    const search = searchParams.get('busca') ?? '';
    // Cancelados ficam de fora por padrão; um filtro de status manda mais.
    const showCancelled = searchParams.get('cancelados') === '1';
    const statuses = status ? status.split(',') : [...PACKAGE_QUEUE_TABS[tab].statuses];
    // Fila de trabalho lista o mais parado primeiro; "Todos" é arquivo.
    const sort = tab !== 'all' || status.includes(',') ? 'oldest' : 'newest';
    const filtered = tab !== 'all' || status !== '' || search !== '' || showCancelled;
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();
    const { queue } = usePendingCounts();
    // Seleção para a folha de montagem e os rastreios. Sobrevive à troca de
    // página e de filtro de propósito: quem monta o turno marca pacotes de
    // várias telas. Guarda o rastreio junto, porque o pacote marcado em outra
    // página não está mais nas linhas carregadas.
    const [selected, setSelected] = useState<ReadonlyMap<string, string | null>>(new Map());

    // A consulta em andamento é identificada pelos filtros: enquanto o que
    // está em tela não corresponder a ela, a lista está carregando.
    const statusParam = statuses.join(',');
    const queryKey = `${pageNumber}|${statusParam}|${search}|${sort}|${showCancelled}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;
    const rows = useMemo(() => result?.data ?? [], [result]);

    useEffect(() => {
        let active = true;
        const key = queryKey;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT), sort });
        if (statusParam) query.set('status', statusParam);
        else if (!showCancelled) query.set('hideCancelled', 'true');
        if (search.length >= 2) query.set('search', search);

        api<Page<AdminPackage>>(`/packages?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch(() => {
                if (active) setFailure({ key, message: t('packages.list.error') });
            });

        return () => {
            active = false;
        };
    }, [queryKey, pageNumber, statusParam, search, sort, showCancelled, t]);

    function applyFilters(next: { tab?: PackageQueueTab; status?: string; search?: string; showCancelled?: boolean }) {
        setPageNumber(1);
        const query = new URLSearchParams();
        if (next.tab && next.tab !== 'all') query.set('fila', next.tab);
        if (next.status) query.set('status', next.status);
        if (next.search) query.set('busca', next.search);
        if (next.showCancelled) query.set('cancelados', '1');
        const queryString = query.toString();
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }

    const clearFilters = () => applyFilters({});

    const tabOptions = (Object.keys(PACKAGE_QUEUE_TABS) as PackageQueueTab[]).map((value) => {
        const tabDef: { statuses: readonly string[]; counts?: readonly WorkQueueStageKey[] } =
            PACKAGE_QUEUE_TABS[value];
        return {
            value,
            label: t(`packages.list.tabs.${value}`),
            count:
                queue && tabDef.counts
                    ? tabDef.counts.reduce((sum, key) => sum + queueStage(queue, key).count, 0)
                    : undefined,
        };
    });

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const allOnPageSelected = rows.length > 0 && rows.every((pkg) => selected.has(pkg.id));

    const toggleSelected = (pkg: AdminPackage) => {
        setSelected((current) => {
            const next = new Map(current);
            if (next.has(pkg.id)) next.delete(pkg.id);
            else next.set(pkg.id, pkg.trackingCode);
            return next;
        });
    };

    const toggleSelectAllOnPage = () => {
        setSelected((current) => {
            const next = new Map(current);
            if (rows.length > 0 && rows.every((pkg) => current.has(pkg.id))) {
                for (const pkg of rows) next.delete(pkg.id);
            } else {
                for (const pkg of rows) next.set(pkg.id, pkg.trackingCode);
            }
            return next;
        });
    };

    const assemblySheetHref = `/impressao/pacotes?ids=${Array.from(selected.keys()).join(',')}`;
    const trackingCodes = Array.from(selected.values()).filter((code): code is string => Boolean(code));
    const withoutTracking = selected.size - trackingCodes.length;
    // Duas caixas podem viajar com o mesmo código; ele sai uma vez só.
    const uniqueTrackingCodes = Array.from(new Set(trackingCodes));

    const columns: DataTableColumn<AdminPackage>[] = [
        {
            key: 'select',
            header: (
                <Checkbox
                    checked={allOnPageSelected}
                    label={<span className="sr-only">{t('packages.list.bulk.selectAllAria')}</span>}
                    onChange={toggleSelectAllOnPage}
                />
            ),
            card: 'hide',
            width: '2.75rem',
            cell: (pkg) => (
                <Checkbox
                    checked={selected.has(pkg.id)}
                    label={
                        <span className="sr-only">{t('packages.list.bulk.selectAria', { code: pkg.packageCode })}</span>
                    }
                    onChange={() => toggleSelected(pkg)}
                />
            ),
        },
        {
            key: 'package',
            header: t('packages.list.columns.package'),
            cell: (pkg) => (
                <Link
                    className="mm-data font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                    href={`/admin/pacotes/${pkg.id}`}
                >
                    {pkg.packageCode}
                </Link>
            ),
        },
        {
            key: 'client',
            header: t('packages.list.columns.client'),
            cell: (pkg) => (
                <span className="block min-w-0">
                    <Link
                        className="block truncate font-semibold text-ink no-underline hover:underline dark:text-night-text"
                        href={`/admin/usuarios/${pkg.userId}`}
                    >
                        {pkg.userName}
                    </Link>
                    <span className="block truncate text-xs text-muted dark:text-night-muted">{pkg.userEmail}</span>
                </span>
            ),
        },
        {
            key: 'items',
            header: t('packages.list.columns.items'),
            hideBelow: 'lg',
            numeric: true,
            cell: (pkg) => {
                const units = totalUnits(pkg.items);
                return (
                    <span className="inline-grid justify-items-end leading-tight">
                        <strong className="mm-data text-sm text-ink dark:text-night-text">{units}</strong>
                        {units !== pkg.items.length && (
                            <span className="text-xs text-muted dark:text-night-muted">
                                {t('packages.list.linesHint', { count: pkg.items.length })}
                            </span>
                        )}
                    </span>
                );
            },
        },
        {
            key: 'tracking',
            header: t('packages.list.columns.tracking'),
            hideBelow: 'md',
            cell: (pkg) =>
                pkg.trackingCode ? (
                    <span className="mm-data text-xs">{pkg.trackingCode}</span>
                ) : (
                    <span className="text-muted dark:text-night-subtle">{t('common.dash')}</span>
                ),
        },
        {
            key: 'status',
            header: t('packages.list.columns.status'),
            cell: (pkg) => (
                <StatusPill tone={packageStatusTone(pkg.status)}>{packageStatusLabel(pkg.status)}</StatusPill>
            ),
        },
        {
            key: 'updatedAt',
            header: t('packages.list.columns.updatedAt'),
            numeric: true,
            cell: (pkg) => <span className="text-ink dark:text-night-text">{formatDate(pkg.updatedAt)}</span>,
        },
        {
            key: 'stage',
            header: t('packages.list.stageColumn'),
            cell: (pkg) => <AgeBadge deadlineAt={pkg.stageDeadlineAt} since={pkg.stageSince} />,
        },
        {
            key: 'createdAt',
            header: t('packages.list.columns.createdAt'),
            hideBelow: 'md',
            numeric: true,
            cell: (pkg) => <span className="text-muted dark:text-night-muted">{formatDate(pkg.createdAt)}</span>,
        },
    ];

    return (
        <div className="grid gap-6">
            <PackagesTabs />
            <PageHeader description={t('packages.list.description')} title={t('packages.list.title')} />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush>
                <Toolbar
                    actions={
                        filtered ? (
                            <Button
                                leadingIcon={<FilterX className="h-4 w-4" aria-hidden="true" />}
                                onClick={clearFilters}
                                size="small"
                                variant="ghost"
                            >
                                {t('common.actions.clearFilters')}
                            </Button>
                        ) : undefined
                    }
                >
                    <div className="grid w-full gap-3">
                        <FilterTabs
                            label={t('packages.list.tabsLabel')}
                            onChange={(value) => applyFilters({ tab: value, search })}
                            options={tabOptions}
                            value={status ? ('custom' as PackageQueueTab) : tab}
                        />
                        <div className="flex flex-wrap items-end gap-3">
                            <SearchInput
                                className="w-full max-w-sm"
                                clearLabel={t('common.actions.clearSearch')}
                                label={t('packages.list.searchLabel')}
                                onChange={(value) => applyFilters({ tab, status, search: value, showCancelled })}
                                placeholder={t('packages.list.searchPlaceholder')}
                                value={search}
                            />
                            <Select
                                fieldClassName="w-full max-w-60"
                                label={t('packages.list.statusLabel')}
                                onChange={(event) =>
                                    applyFilters({ status: event.target.value, search, showCancelled })
                                }
                                placeholderOption={t('packages.list.statusAll')}
                                value={status.includes(',') ? '' : status}
                                options={PACKAGE_STATUSES.map((value) => ({ value, label: packageStatusLabel(value) }))}
                            />
                            <Checkbox
                                checked={showCancelled || status === 'CANCELLED' || status === 'SHIPPING_FAILED'}
                                className="pb-2.5"
                                disabled={statuses.length > 0}
                                label={t('packages.list.showCancelled')}
                                onChange={(event) => applyFilters({ tab, search, showCancelled: event.target.checked })}
                            />
                        </div>
                    </div>
                </Toolbar>

                {selected.size > 0 && (
                    <Toolbar
                        className="bg-warm-100 dark:bg-night-canvas"
                        actions={
                            <>
                                <CopyButton
                                    disabled={uniqueTrackingCodes.length === 0}
                                    label={t('packages.list.bulk.copyTracking', { count: uniqueTrackingCodes.length })}
                                    text={uniqueTrackingCodes.join(' ')}
                                />
                                <ButtonLink
                                    href={assemblySheetHref}
                                    leadingIcon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
                                    rel="noopener"
                                    size="small"
                                    target="_blank"
                                    variant="primary"
                                >
                                    {t('packages.list.bulk.assemblySheet')}
                                </ButtonLink>
                            </>
                        }
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-night-text">
                            {t('packages.list.bulk.selectedCount', { count: selected.size })}
                            {withoutTracking > 0 && (
                                <span className="font-normal text-muted dark:text-night-muted">
                                    {t('packages.list.bulk.withoutTracking', { count: withoutTracking })}
                                </span>
                            )}
                            <Button
                                aria-label={t('packages.list.bulk.clearSelection')}
                                iconOnly
                                onClick={() => setSelected(new Map())}
                                size="small"
                                variant="ghost"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </span>
                    </Toolbar>
                )}

                <DataTable
                    caption={t('packages.list.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('packages.list.loading')}
                    minWidth="54rem"
                    rowKey={(pkg) => pkg.id}
                    rows={rows}
                    empty={
                        <EmptyState
                            description={filtered ? t('packages.list.emptyFilteredDescription') : undefined}
                            icon={Boxes}
                            title={filtered ? t('packages.list.emptyFiltered') : t('packages.list.empty')}
                            action={
                                filtered ? (
                                    <Button onClick={clearFilters} size="small" variant="secondary">
                                        {t('common.actions.clearFilters')}
                                    </Button>
                                ) : undefined
                            }
                        />
                    }
                />

                {result && result.data.length > 0 && (
                    <Pagination
                        disabled={loading}
                        nextLabel={t('common.pagination.next')}
                        onChange={setPageNumber}
                        page={pageNumber}
                        previousLabel={t('common.pagination.previous')}
                        totalPages={totalPages}
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('packages.list.countUnit', { count: result.total })}`}
                    />
                )}
            </SectionCard>
        </div>
    );
}
