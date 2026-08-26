'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { ORDER_STATUSES, money, formatDate, orderStatusLabel, type AdminOrder, type Page } from '@/types/api';

const LIMIT = 20;

export function OrdersListPage() {
    const { t } = useTranslation();
    const searchParams = useSearchParams();
    const initialStatus = searchParams.get('status') ?? '';
    const [status, setStatus] = useState(initialStatus);
    const [page, setPage] = useState<Page<AdminOrder>>();
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true);

    function load(currentStatus: string, currentPage: number) {
        setLoading(true);
        const query = new URLSearchParams({ page: String(currentPage), limit: String(LIMIT) });
        if (currentStatus) query.set('status', currentStatus);
        api<Page<AdminOrder>>(`/orders?${query.toString()}`)
            .then(setPage)
            .catch(() => setError(t('orders.list.error')))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        load(initialStatus, 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPageNumber(1);
        load(status, 1);
    }

    function goToPage(next: number) {
        setPageNumber(next);
        load(status, next);
    }

    const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;

    return (
        <main>
            <p className="mm-kicker mb-3">{t('orders.list.kicker')}</p>
            <h1 className="m-0 text-3xl tracking-[-.03em]">{t('orders.list.title')}</h1>
            <p className="mt-2 max-w-2xl text-muted dark:text-night-muted">{t('orders.list.description')}</p>

            <form className="mt-6 flex flex-wrap items-end gap-4" onSubmit={handleSearch}>
                <label className="grid gap-2 text-sm font-semibold">
                    {t('orders.list.statusLabel')}
                    <select
                        className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                    >
                        <option value="">{t('orders.list.statusAll')}</option>
                        {ORDER_STATUSES.map((value) => (
                            <option key={value} value={value}>
                                {orderStatusLabel(value)}
                            </option>
                        ))}
                    </select>
                </label>
                <Button type="submit" variant="secondary">
                    {t('orders.list.searchButton')}
                </Button>
            </form>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {loading && <p className="mt-6 text-muted">{t('orders.list.loading')}</p>}

            {!loading && page && (
                <>
                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[860px] border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase dark:border-night-line dark:text-night-subtle">
                                    <th className="py-3 pr-4">{t('orders.list.columns.order')}</th>
                                    <th className="py-3 pr-4">{t('orders.list.columns.client')}</th>
                                    <th className="py-3 pr-4">{t('orders.list.columns.items')}</th>
                                    <th className="py-3 pr-4">{t('orders.list.columns.total')}</th>
                                    <th className="py-3 pr-4">{t('orders.list.columns.status')}</th>
                                    <th className="py-3 pr-4">{t('orders.list.columns.createdAt')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.data.map((order) => (
                                    <tr className="border-b border-line dark:border-night-line" key={order.id}>
                                        <td className="py-3 pr-4">
                                            <Link className="font-semibold text-primary" href={`/admin/pedidos/${order.id}`}>
                                                {order.id.slice(0, 8)}
                                            </Link>
                                        </td>
                                        <td className="py-3 pr-4">
                                            <Link className="font-semibold text-primary hover:underline" href={`/admin/usuarios/${order.userId}`}>
                                                {order.userName}
                                            </Link>
                                            <p className="mt-0.5 text-xs text-muted dark:text-night-muted">{order.userEmail}</p>
                                        </td>
                                        <td className="py-3 pr-4">{order.items.length}</td>
                                        <td className="py-3 pr-4 mm-data">{money(order.totalAmountMinor, order.currency)}</td>
                                        <td className="py-3 pr-4">
                                            <span className="mm-kicker">{orderStatusLabel(order.status)}</span>
                                        </td>
                                        <td className="py-3 pr-4 text-muted dark:text-night-muted">{formatDate(order.createdAt)}</td>
                                    </tr>
                                ))}
                                {page.data.length === 0 && (
                                    <tr>
                                        <td className="py-6 text-muted" colSpan={6}>
                                            {t('orders.list.empty')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                        <span className="text-muted dark:text-night-muted">
                            {t('common.pagination.page', { page: pageNumber, total: totalPages })} · {t('orders.list.countUnit', { count: page.total })}
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
