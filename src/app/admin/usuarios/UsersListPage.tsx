'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SearchX, Users } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { Pagination } from '@/components/admin/Pagination';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill, userStatusTone } from '@/components/admin/StatusPill';
import { Toolbar } from '@/components/admin/Toolbar';
import { SearchInput } from '@/components/ui/SearchInput';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import type { AdminUser, Page } from '@/types/api';
import { formatDate, userStatusLabel } from '@/types/api';

const LIMIT = 20;

interface LoadedPage {
    /** Identifica a consulta que produziu estes dados (página + busca). */
    key: string;
    page: Page<AdminUser>;
}

interface Failure {
    key: string;
    message: string;
}

export function UsersListPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [pageNumber, setPageNumber] = useState(1);
    const [loaded, setLoaded] = useState<LoadedPage>();
    const [failure, setFailure] = useState<Failure>();

    // A consulta em andamento é identificada por página + termo: enquanto o que
    // está em tela não corresponder a ela, a lista está carregando.
    const queryKey = `${pageNumber}|${search}`;
    const result = loaded?.key === queryKey ? loaded.page : undefined;
    const error = failure?.key === queryKey ? failure.message : undefined;
    const loading = !result && !error;

    useEffect(() => {
        let active = true;
        const key = `${pageNumber}|${search}`;
        const query = new URLSearchParams({ page: String(pageNumber), limit: String(LIMIT) });
        if (search) query.set('search', search);

        api<Page<AdminUser>>(`/users?${query.toString()}`)
            .then((page) => {
                if (active) setLoaded({ key, page });
            })
            .catch(() => {
                if (active) setFailure({ key, message: t('users.list.error') });
            });

        return () => {
            active = false;
        };
    }, [pageNumber, search, t]);

    // Trocar o termo sempre volta para a primeira página: a paginação antiga
    // não vale mais para o novo conjunto de resultados.
    const handleSearch = useCallback((term: string) => {
        setSearch(term);
        setPageNumber(1);
    }, []);

    const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

    const columns: DataTableColumn<AdminUser>[] = [
        {
            key: 'name',
            header: t('users.list.columns.name'),
            cell: (user) => (
                <Link
                    className="font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                    href={`/admin/usuarios/${user.id}`}
                >
                    {user.name}
                </Link>
            ),
        },
        {
            key: 'username',
            header: t('users.list.columns.username'),
            hideBelow: 'lg',
            cell: (user) => <span className="text-muted dark:text-night-muted">{user.username}</span>,
        },
        {
            key: 'email',
            header: t('users.list.columns.email'),
            hideBelow: 'sm',
            cell: (user) => <span className="text-muted dark:text-night-muted">{user.email}</span>,
        },
        {
            key: 'status',
            header: t('users.list.columns.status'),
            cell: (user) => <StatusPill tone={userStatusTone(user.status)}>{userStatusLabel(user.status)}</StatusPill>,
        },
        {
            key: 'createdAt',
            header: t('users.list.columns.createdAt'),
            hideBelow: 'md',
            numeric: true,
            cell: (user) => <span className="text-muted dark:text-night-muted">{formatDate(user.createdAt)}</span>,
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('users.list.description')}
                kicker={t('users.list.kicker')}
                title={t('users.list.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush>
                <Toolbar>
                    <SearchInput
                        className="w-full max-w-sm"
                        clearLabel={t('common.actions.clearSearch')}
                        label={t('users.list.searchLabel')}
                        onChange={handleSearch}
                        placeholder={t('users.list.searchPlaceholder')}
                        value={search}
                    />
                </Toolbar>

                <DataTable
                    caption={t('users.list.tableCaption')}
                    columns={columns}
                    loading={loading}
                    loadingLabel={t('users.list.loading')}
                    minWidth="44rem"
                    rowKey={(user) => user.id}
                    rows={result?.data ?? []}
                    empty={
                        search ? (
                            <EmptyState
                                description={t('users.list.emptySearchDescription')}
                                icon={SearchX}
                                title={t('users.list.emptySearch')}
                            />
                        ) : (
                            <EmptyState icon={Users} title={t('users.list.empty')} />
                        )
                    }
                />

                {result && result.data.length > 0 && (
                    <Pagination
                        nextLabel={t('common.pagination.next')}
                        onChange={setPageNumber}
                        page={pageNumber}
                        previousLabel={t('common.pagination.previous')}
                        disabled={loading}
                        totalPages={totalPages}
                        summary={`${t('common.pagination.page', { page: pageNumber, total: totalPages })} · ${t('users.list.countUnit', { count: result.total })}`}
                    />
                )}
            </SectionCard>
        </div>
    );
}
