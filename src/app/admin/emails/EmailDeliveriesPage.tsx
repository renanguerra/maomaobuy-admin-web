'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { FilterTabs } from '@/components/admin/FilterTabs';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { emailDeliveryStatusTone, StatusPill } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { formatDate, type AdminEmailDelivery, type EmailDeliveryStatus, type Page } from '@/types/api';

type Filter = EmailDeliveryStatus | 'all';

const LIMIT = 25;

/**
 * A resposta para "o cliente foi avisado?".
 *
 * Antes, um envio recusado pelo provedor virava uma linha de log que ninguém
 * consultava. Aqui a fila é a evidência: o que saiu, o que falhou e por quê.
 */
export function EmailDeliveriesPage() {
    const { t } = useTranslation();
    const [result, setResult] = useState<Page<AdminEmailDelivery>>();
    const [filter, setFilter] = useState<Filter>('all');
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState<string>();

    const load = useCallback(() => {
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (filter !== 'all') query.set('status', filter);

        api<Page<AdminEmailDelivery>>(`/email-deliveries?${query.toString()}`)
            .then((page) => {
                setResult(page);
                setError(undefined);
            })
            .catch(() => setError(t('emails.error')));
    }, [filter, pageNumber, t]);

    useEffect(() => {
        load();
    }, [load]);

    function changeFilter(value: Filter) {
        setFilter(value);
        setPageNumber(1);
    }

    // O dicionário é tipado por chave literal: um `t(\`...${valor}\`)` não
    // passa pela checagem. O mapa deixa o compilador conferir os quatro.
    const statusLabel = (status: EmailDeliveryStatus): string =>
        ({
            PENDING: t('emails.statuses.PENDING'),
            SENT: t('emails.statuses.SENT'),
            FAILED: t('emails.statuses.FAILED'),
            SKIPPED: t('emails.statuses.SKIPPED'),
        })[status];

    const columns: DataTableColumn<AdminEmailDelivery>[] = [
        {
            key: 'kind',
            header: t('emails.columns.kind'),
            cell: (row) => <span className="mm-data text-ink dark:text-night-text">{row.kind}</span>,
        },
        {
            key: 'recipient',
            header: t('emails.columns.recipient'),
            hideBelow: 'md',
            cell: (row) =>
                row.userId ? (
                    <Link
                        className="mm-data text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/usuarios/${row.userId}`}
                    >
                        @{row.recipientDomain}
                    </Link>
                ) : (
                    <span className="mm-data text-muted dark:text-night-subtle">@{row.recipientDomain}</span>
                ),
        },
        {
            key: 'status',
            header: t('emails.columns.status'),
            cell: (row) => (
                <StatusPill tone={emailDeliveryStatusTone(row.status)}>
                    {statusLabel(row.status as EmailDeliveryStatus)}
                </StatusPill>
            ),
        },
        {
            key: 'attempts',
            header: t('emails.columns.attempts'),
            hideBelow: 'lg',
            numeric: true,
            cell: (row) => <span className="text-muted dark:text-night-muted">{row.attempts}</span>,
        },
        {
            key: 'lastError',
            header: t('emails.columns.lastError'),
            hideBelow: 'lg',
            cell: (row) =>
                row.lastError ? (
                    <span
                        className="block max-w-[24rem] truncate text-origin-700 dark:text-night-coral"
                        title={row.lastError}
                    >
                        {row.lastError}
                    </span>
                ) : (
                    <span className="text-muted dark:text-night-subtle">—</span>
                ),
        },
        {
            key: 'createdAt',
            header: t('emails.columns.createdAt'),
            hideBelow: 'md',
            numeric: true,
            cell: (row) => (
                <span className="text-muted dark:text-night-muted">{formatDate(row.sentAt ?? row.createdAt)}</span>
            ),
        },
    ];

    const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / LIMIT));

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('emails.description')}
                kicker={t('emails.kicker')}
                title={t('emails.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush title={t('emails.sectionTitle')}>
                <Toolbar>
                    <FilterTabs
                        label={t('emails.filterLabel')}
                        onChange={(value) => changeFilter(value as Filter)}
                        value={filter}
                        options={[
                            { value: 'all', label: t('emails.filters.all') },
                            { value: 'PENDING', label: statusLabel('PENDING') },
                            { value: 'FAILED', label: statusLabel('FAILED') },
                            { value: 'SENT', label: statusLabel('SENT') },
                            { value: 'SKIPPED', label: statusLabel('SKIPPED') },
                        ]}
                    />
                </Toolbar>

                <DataTable
                    caption={t('emails.tableCaption')}
                    columns={columns}
                    loading={!result && !error}
                    loadingLabel={t('emails.loading')}
                    minWidth="60rem"
                    rowKey={(row) => row.id}
                    rows={result?.data ?? []}
                    empty={<EmptyState description={t('emails.emptyDescription')} icon={Mail} title={t('emails.empty')} />}
                />

                {result && result.data.length > 0 && (
                    <Pagination
                        nextLabel={t('common.pagination.next')}
                        onChange={setPageNumber}
                        page={pageNumber}
                        previousLabel={t('common.pagination.previous')}
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('emails.countUnit', { count: result.total })}`}
                        totalPages={totalPages}
                    />
                )}
            </SectionCard>
        </div>
    );
}
