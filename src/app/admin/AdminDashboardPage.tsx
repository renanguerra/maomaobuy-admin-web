'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import type { AdminOrder, AdminPackage, AdminRefundRequest, Page } from '@/types/api';

interface DashboardData {
    ordersAwaitingReviewCount: number;
    packagesAwaitingApprovalCount: number;
    refundsRequested: AdminRefundRequest[];
}

export function AdminDashboardPage() {
    const [data, setData] = useState<DashboardData>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        Promise.all([
            api<Page<AdminOrder>>('/orders?status=AWAITING_REVIEW&limit=1'),
            api<Page<AdminPackage>>('/packages?status=AWAITING_APPROVAL&limit=1'),
            api<AdminRefundRequest[]>('/finance/refunds'),
        ])
            .then(([ordersAwaitingReview, packagesAwaitingApproval, refunds]) =>
                setData({
                    ordersAwaitingReviewCount: ordersAwaitingReview.total,
                    packagesAwaitingApprovalCount: packagesAwaitingApproval.total,
                    refundsRequested: refunds.filter((refund) => refund.status === 'REQUESTED'),
                }),
            )
            .catch(() => setError('Não foi possível carregar o painel.'));
    }, []);

    return (
        <main>
            <p className="mm-kicker mb-3">Painel administrativo</p>
            <h1 className="m-0 text-3xl tracking-[-.03em]">Visão geral</h1>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {!data && !error && <p className="mt-6 text-muted">Carregando indicadores…</p>}

            {data && (
                <div className="mt-8 grid grid-cols-3 gap-5 max-[800px]:grid-cols-1">
                    <Link
                        className="mm-panel block p-6 no-underline text-ink transition hover:border-brand-300 dark:text-night-text"
                        href="/admin/pedidos?status=AWAITING_REVIEW"
                    >
                        <p className="m-0 text-sm text-muted dark:text-night-muted">Pedidos aguardando análise</p>
                        <strong className="mm-data mt-2 block text-4xl">{data.ordersAwaitingReviewCount}</strong>
                    </Link>
                    <Link
                        className="mm-panel block p-6 no-underline text-ink transition hover:border-brand-300 dark:text-night-text"
                        href="/admin/pacotes?status=AWAITING_APPROVAL"
                    >
                        <p className="m-0 text-sm text-muted dark:text-night-muted">Pacotes aguardando aprovação</p>
                        <strong className="mm-data mt-2 block text-4xl">{data.packagesAwaitingApprovalCount}</strong>
                    </Link>
                    <Link
                        className="mm-panel block p-6 no-underline text-ink transition hover:border-brand-300 dark:text-night-text"
                        href="/admin/financeiro"
                    >
                        <p className="m-0 text-sm text-muted dark:text-night-muted">Reembolsos pendentes</p>
                        <strong className="mm-data mt-2 block text-4xl">{data.refundsRequested.length}</strong>
                    </Link>
                </div>
            )}
        </main>
    );
}
