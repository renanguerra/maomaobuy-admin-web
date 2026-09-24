'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Boxes, ClipboardList, FilterX, X } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { packageStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import {
    PACKAGE_STATUSES,
    formatDate,
    packageStatusLabel,
    totalUnits,
    type AdminPackage,
    type Page,
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

    const status = searchParams.get('status') ?? '';
    // Cancelados ficam de fora por padrão; um filtro de status manda mais.
    const showCancelled = searchParams.get('cancelados') === '1';
    const filtered = status !== '' || showCancelled;
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();
    // Seleção para a folha de montagem. Sobrevive à troca de página e de
    // filtro de propósito: quem monta o turno marca pacotes de várias telas.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // A consulta em andamento é identificada por página + filtros: enquanto o
    // que está em tela não corresponder a ela, a lista está carregando.
    const queryKey = `${pageNumber}|${status}|${showCancelled}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;
    const rows = useMemo(() => result?.data ?? [], [result]);

    useEffect(() => {
        let active = true;
        const key = `${pageNumber}|${status}|${showCancelled}`;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (status) query.set('status', status);
        else if (!showCancelled) query.set('hideCancelled', 'true');

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
    }, [pageNumber, status, showCancelled, t]);

    const applyFilters = useCallback(
        (next: { status: string; showCancelled: boolean }) => {
            setPageNumber(1);
            const query = new URLSearchParams();
            if (next.status) query.set('status', next.status);
            if (next.showCancelled) query.set('cancelados', '1');
            const search = query.toString();
            router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
        },
        [pathname, router],
    );

    const clearFilters = useCallback(() => applyFilters({ status: '', showCancelled: false }), [applyFilters]);

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const allOnPageSelected = rows.length > 0 && rows.every((pkg) => selectedIds.has(pkg.id));

    const toggleSelected = useCallback((id: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAllOnPage = useCallback(() => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (rows.length > 0 && rows.every((pkg) => current.has(pkg.id))) {
                for (const pkg of rows) next.delete(pkg.id);
            } else {
                for (const pkg of rows) next.add(pkg.id);
            }
            return next;
        });
    }, [rows]);

    const assemblySheetHref = `/impressao/pacotes?ids=${Array.from(selectedIds).join(',')}`;

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
                    checked={selectedIds.has(pkg.id)}
                    label={
                        <span className="sr-only">{t('packages.list.bulk.selectAria', { code: pkg.packageCode })}</span>
                    }
                    onChange={() => toggleSelected(pkg.id)}
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
            key: 'createdAt',
            header: t('packages.list.columns.createdAt'),
            hideBelow: 'md',
            numeric: true,
            cell: (pkg) => <span className="text-muted dark:text-night-muted">{formatDate(pkg.createdAt)}</span>,
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('packages.list.description')}
                kicker={t('packages.list.kicker')}
                title={t('packages.list.title')}
            />

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
                    <Select
                        fieldClassName="w-full max-w-xs"
                        label={t('packages.list.statusLabel')}
                        onChange={(event) => applyFilters({ status: event.target.value, showCancelled })}
                        placeholderOption={t('packages.list.statusAll')}
                        value={status}
                        options={PACKAGE_STATUSES.map((value) => ({ value, label: packageStatusLabel(value) }))}
                    />
                    <Checkbox
                        checked={showCancelled || status === 'CANCELLED'}
                        className="pb-2.5"
                        disabled={status !== ''}
                        label={t('packages.list.showCancelled')}
                        onChange={(event) => applyFilters({ status, showCancelled: event.target.checked })}
                    />
                </Toolbar>

                {selectedIds.size > 0 && (
                    <Toolbar
                        className="bg-warm-100 dark:bg-night-canvas"
                        actions={
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
                        }
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-night-text">
                            {t('packages.list.bulk.selectedCount', { count: selectedIds.size })}
                            <Button
                                aria-label={t('packages.list.bulk.clearSelection')}
                                iconOnly
                                onClick={() => setSelectedIds(new Set())}
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
