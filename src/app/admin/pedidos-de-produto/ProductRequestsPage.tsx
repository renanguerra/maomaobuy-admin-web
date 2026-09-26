'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MessageSquare, Pencil, PackageSearch } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { productRequestStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { refreshPendingCounts } from '@/services/admin/pending-counts';
import { api } from '@/services/api';
import {
    formatDate,
    productRequestStatusLabel,
    type AdminProductRequest,
    type Page,
    type ProductRequestStatus,
} from '@/types/api';
import { ProductRequestStatusDialog } from './ProductRequestStatusDialog';

type Filter = ProductRequestStatus | 'all';

export function ProductRequestsPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [requests, setRequests] = useState<AdminProductRequest[]>();
    const [filter, setFilter] = useState<Filter>('NEW');
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState<AdminProductRequest>();

    const load = useCallback(() => {
        api<Page<AdminProductRequest>>('/product-requests?limit=50')
            .then((page) => {
                setRequests(page.data);
                setError(undefined);
            })
            .catch(() => setError(t('productRequests.error')));
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    function handleUpdated(updated: AdminProductRequest) {
        setRequests((current) => current?.map((row) => (row.id === updated.id ? updated : row)));
        setEditing(undefined);
        notify({ tone: 'success', title: t('productRequests.feedback.updated') });
        void refreshPendingCounts();
    }

    const counts = useMemo(() => {
        const byStatus: Record<ProductRequestStatus, number> = {
            NEW: 0,
            REVIEWING: 0,
            FULFILLED: 0,
            DECLINED: 0,
        };
        for (const request of requests ?? []) byStatus[request.status as ProductRequestStatus]++;
        return byStatus;
    }, [requests]);

    const rows = useMemo(
        () => (filter === 'all' ? (requests ?? []) : (requests ?? []).filter((request) => request.status === filter)),
        [filter, requests],
    );

    const columns: DataTableColumn<AdminProductRequest>[] = [
        {
            key: 'description',
            header: t('productRequests.columns.description'),
            cell: (request) => (
                <Link
                    className="block max-w-[32rem] truncate font-semibold text-ink no-underline hover:underline dark:text-night-text"
                    href={`/admin/pedidos-de-produto/${request.id}`}
                    title={request.description}
                >
                    {request.description}
                </Link>
            ),
        },
        {
            key: 'user',
            header: t('productRequests.columns.user'),
            cell: (request) => (
                <span className="block min-w-0">
                    <Link
                        className="block truncate font-semibold text-ink no-underline hover:underline dark:text-night-text"
                        href={`/admin/usuarios/${request.userId}`}
                    >
                        {request.userName ?? request.userId.slice(0, 8)}
                    </Link>
                    {request.userEmail && (
                        <span className="block truncate text-xs text-muted dark:text-night-muted">
                            {request.userEmail}
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'reference',
            header: t('productRequests.columns.reference'),
            hideBelow: 'md',
            cell: (request) =>
                request.referenceUrl ? (
                    <a
                        className="inline-flex items-center gap-1 text-primary no-underline hover:underline dark:text-night-accent"
                        href={request.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t('productRequests.referenceLink')}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                ) : (
                    <span className="text-muted dark:text-night-subtle">{t('productRequests.noReference')}</span>
                ),
        },
        {
            key: 'status',
            header: t('productRequests.columns.status'),
            cell: (request) => (
                <StatusPill tone={productRequestStatusTone(request.status)}>
                    {productRequestStatusLabel(request.status)}
                </StatusPill>
            ),
        },
        {
            key: 'createdAt',
            header: t('productRequests.columns.createdAt'),
            hideBelow: 'lg',
            numeric: true,
            cell: (request) => (
                <span className="text-muted dark:text-night-muted">{formatDate(request.createdAt)}</span>
            ),
        },
        {
            key: 'actions',
            header: <span className="sr-only">{t('productRequests.columns.actions')}</span>,
            align: 'right',
            card: 'full',
            cell: (request) => (
                <span className="flex flex-wrap justify-end gap-2">
                    <ButtonLink
                        href={`/admin/pedidos-de-produto/${request.id}`}
                        leadingIcon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
                        size="small"
                        variant="ghost"
                    >
                        {t('productRequests.openButton')}
                    </ButtonLink>
                    <Button
                        leadingIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => setEditing(request)}
                        size="small"
                        variant="secondary"
                    >
                        {t('productRequests.updateButton')}
                    </Button>
                </span>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('productRequests.description')}
                kicker={t('productRequests.kicker')}
                title={t('productRequests.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush title={t('productRequests.sectionTitle')}>
                <Toolbar>
                    <FilterTabs
                        label={t('productRequests.filterLabel')}
                        onChange={(value) => setFilter(value as Filter)}
                        value={filter}
                        options={[
                            { value: 'NEW', label: t('productRequests.filters.new'), count: counts.NEW },
                            {
                                value: 'REVIEWING',
                                label: t('productRequests.filters.reviewing'),
                                count: counts.REVIEWING,
                            },
                            {
                                value: 'FULFILLED',
                                label: t('productRequests.filters.fulfilled'),
                                count: counts.FULFILLED,
                            },
                            { value: 'DECLINED', label: t('productRequests.filters.declined'), count: counts.DECLINED },
                            { value: 'all', label: t('productRequests.filters.all'), count: requests?.length },
                        ]}
                    />
                </Toolbar>

                <DataTable
                    caption={t('productRequests.tableCaption')}
                    columns={columns}
                    loading={!requests && !error}
                    loadingLabel={t('productRequests.loading')}
                    minWidth="56rem"
                    rowKey={(request) => request.id}
                    rows={rows}
                    empty={
                        <EmptyState
                            description={t('productRequests.emptyDescription')}
                            icon={PackageSearch}
                            title={filter === 'all' ? t('productRequests.emptyAll') : t('productRequests.empty')}
                        />
                    }
                />
            </SectionCard>

            <ProductRequestStatusDialog
                onCancel={() => setEditing(undefined)}
                onUpdated={handleUpdated}
                request={editing}
            />
        </div>
    );
}
