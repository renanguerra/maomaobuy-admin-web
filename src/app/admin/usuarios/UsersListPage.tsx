'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import type { AdminUser, Page } from '@/types/api';
import { formatDate, userStatusLabel } from '@/types/api';

const LIMIT = 20;

export function UsersListPage() {
    const { t } = useTranslation();
    const [page, setPage] = useState<Page<AdminUser>>();
    const [search, setSearch] = useState('');
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true);

    function load(currentSearch: string, currentPage: number) {
        setLoading(true);
        const query = new URLSearchParams({ page: String(currentPage), limit: String(LIMIT) });
        if (currentSearch) query.set('search', currentSearch);
        api<Page<AdminUser>>(`/users?${query.toString()}`)
            .then(setPage)
            .catch(() => setError(t('users.list.error')))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        load('', 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPageNumber(1);
        load(search, 1);
    }

    function goToPage(next: number) {
        setPageNumber(next);
        load(search, next);
    }

    const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

    return (
        <main>
            <p className="mm-kicker mb-3">{t('users.list.kicker')}</p>
            <h1 className="m-0 text-3xl tracking-[-.03em]">{t('users.list.title')}</h1>

            <form className="mt-6 flex max-w-md gap-3" onSubmit={handleSearch}>
                <input
                    className="min-h-11 w-full rounded-md border border-line bg-surface px-4 dark:border-night-line dark:bg-night-surface"
                    name="search"
                    placeholder={t('users.list.searchPlaceholder')}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <Button type="submit" variant="secondary">
                    {t('users.list.searchButton')}
                </Button>
            </form>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {loading && <p className="mt-6 text-muted">{t('users.list.loading')}</p>}

            {!loading && page && (
                <>
                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[720px] border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase dark:border-night-line dark:text-night-subtle">
                                    <th className="py-3 pr-4">{t('users.list.columns.name')}</th>
                                    <th className="py-3 pr-4">{t('users.list.columns.username')}</th>
                                    <th className="py-3 pr-4">{t('users.list.columns.email')}</th>
                                    <th className="py-3 pr-4">{t('users.list.columns.status')}</th>
                                    <th className="py-3 pr-4">{t('users.list.columns.createdAt')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.data.map((user) => (
                                    <tr className="border-b border-line dark:border-night-line" key={user.id}>
                                        <td className="py-3 pr-4">
                                            <Link className="font-semibold text-primary" href={`/admin/usuarios/${user.id}`}>
                                                {user.name}
                                            </Link>
                                        </td>
                                        <td className="py-3 pr-4">{user.username}</td>
                                        <td className="py-3 pr-4">{user.email}</td>
                                        <td className="py-3 pr-4">
                                            <span className="mm-kicker">{userStatusLabel(user.status)}</span>
                                        </td>
                                        <td className="py-3 pr-4 text-muted dark:text-night-muted">
                                            {formatDate(user.createdAt)}
                                        </td>
                                    </tr>
                                ))}
                                {page.data.length === 0 && (
                                    <tr>
                                        <td className="py-6 text-muted" colSpan={5}>
                                            {t('users.list.empty')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                        <span className="text-muted dark:text-night-muted">
                            {t('common.pagination.page', { page: pageNumber, total: totalPages })} · {t('users.list.countUnit', { count: page.total })}
                        </span>
                        <div className="flex gap-3">
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => goToPage(pageNumber - 1)}
                                disabled={pageNumber <= 1}
                            >
                                {t('common.pagination.previous')}
                            </Button>
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => goToPage(pageNumber + 1)}
                                disabled={pageNumber >= totalPages}
                            >
                                {t('common.pagination.next')}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}
