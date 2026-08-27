'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Boxes, FilterX } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { packageStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { PACKAGE_STATUSES, formatDate, packageStatusLabel, type AdminPackage, type Page } from '@/types/api';

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
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();

    // A consulta em andamento é identificada por página + status: enquanto o que
    // está em tela não corresponder a ela, a lista está carregando.
    const queryKey = `${pageNumber}|${status}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        let active = true;
        const key = `${pageNumber}|${status}`;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (status) query.set('status', status);

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
    }, [pageNumber, status, t]);

    const applyStatus = useCallback(
        (next: string) => {
            setPageNumber(1);
            router.replace(next ? `${pathname}?status=${next}` : pathname, { scroll: false });
        },
        [pathname, router],
    );

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const columns: DataTableColumn<AdminPackage>[] = [
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
            cell: (pkg) => pkg.items.length,
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
                        status ? (
                            <Button
                                leadingIcon={<FilterX className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => applyStatus('')}
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
                        onChange={(event) => applyStatus(event.target.value)}
                        placeholderOption={t('packages.list.statusAll')}
                        value={status}
                        options={PACKAGE_STATUSES.map((value) => ({ value, label: packageStatusLabel(value) }))}
                    />
                </Toolbar>

                <DataTable
                    caption={t('packages.list.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('packages.list.loading')}
                    minWidth="52rem"
                    rowKey={(pkg) => pkg.id}
                    rows={result?.data ?? []}
                    empty={
                        <EmptyState
                            description={status ? t('packages.list.emptyFilteredDescription') : undefined}
                            icon={Boxes}
                            title={status ? t('packages.list.emptyFiltered') : t('packages.list.empty')}
                            action={
                                status ? (
                                    <Button onClick={() => applyStatus('')} size="small" variant="secondary">
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
