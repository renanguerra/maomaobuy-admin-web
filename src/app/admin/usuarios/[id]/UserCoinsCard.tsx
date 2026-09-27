'use client';

import { useCallback, useEffect, useState } from 'react';
import { Coins, SlidersHorizontal } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { DescriptionList } from '@/components/admin/DescriptionList';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { formatDate, type AdminCoinSummary, type AdminCoinTransaction } from '@/types/api';

const STATUS_TONE: Record<AdminCoinTransaction['status'], 'warning' | 'success' | 'neutral'> = {
    PENDING: 'warning',
    AVAILABLE: 'success',
    REVERSED: 'neutral',
};

/**
 * MaoMaoCoins do cliente. Ler é de qualquer admin (o suporte explica o
 * extrato); ajustar é do financeiro, com TOTP e motivo — o backend recusa
 * os outros papéis, e o motivo fica no lançamento.
 */
export function UserCoinsCard({ userId }: { userId: string }) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [summary, setSummary] = useState<AdminCoinSummary>();
    const [error, setError] = useState(false);
    const [adjusting, setAdjusting] = useState(false);

    const load = useCallback(() => {
        api<AdminCoinSummary>(`/coins/users/${userId}`)
            .then((loaded) => {
                setSummary(loaded);
                setError(false);
            })
            .catch(() => setError(true));
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    async function adjust(values: { totpCode: string; reason: string } & Record<string, string>) {
        try {
            const updated = await api<AdminCoinSummary>(`/coins/users/${userId}/adjustments`, {
                method: 'POST',
                body: JSON.stringify({
                    totpCode: values.totpCode,
                    reason: values.reason,
                    amount: Number(values.amount),
                }),
            });
            setSummary(updated);
            setAdjusting(false);
            notify({ tone: 'success', title: t('users.detail.coinsSection.adjusted') });
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('common.errors.generic'));
        }
    }

    if (error)
        return (
            <SectionCard dense icon={<Coins aria-hidden="true" />} title={t('users.detail.coinsSection.title')}>
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{t('users.detail.coinsSection.error')}</p>
                </Alert>
            </SectionCard>
        );

    if (!summary) return null;

    const statusLabel: Record<AdminCoinTransaction['status'], string> = {
        PENDING: t('users.detail.coinsSection.statusPending'),
        AVAILABLE: t('users.detail.coinsSection.statusAvailable'),
        REVERSED: t('users.detail.coinsSection.statusReversed'),
    };

    return (
        <>
            <SectionCard
                dense
                description={t('users.detail.coinsSection.description')}
                icon={<Coins aria-hidden="true" />}
                title={t('users.detail.coinsSection.title')}
                action={
                    <Button
                        leadingIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => setAdjusting(true)}
                        size="small"
                        variant="secondary"
                    >
                        {t('users.detail.coinsSection.adjustButton')}
                    </Button>
                }
            >
                <DescriptionList
                    items={[
                        {
                            label: t('users.detail.coinsSection.available'),
                            value: String(summary.wallet.available),
                            numeric: true,
                        },
                        {
                            label: t('users.detail.coinsSection.pending'),
                            value: String(summary.wallet.pending),
                            numeric: true,
                        },
                        {
                            label: t('users.detail.coinsSection.earned'),
                            value: String(summary.wallet.lifetimeEarned),
                            numeric: true,
                        },
                        {
                            label: t('users.detail.coinsSection.spent'),
                            value: String(summary.wallet.lifetimeSpent),
                            numeric: true,
                        },
                    ]}
                />

                <h3 className="mt-5 mb-2 text-sm font-semibold">{t('users.detail.coinsSection.historyTitle')}</h3>
                {summary.transactions.length === 0 ? (
                    <p className="m-0 text-sm text-muted">{t('users.detail.coinsSection.empty')}</p>
                ) : (
                    <ul className="m-0 grid max-h-80 list-none overflow-y-auto p-0">
                        {summary.transactions.slice(0, 50).map((entry) => (
                            <li
                                className="flex items-start gap-3 border-b border-line py-2 text-sm last:border-b-0"
                                key={entry.id}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block">{entry.description}</span>
                                    {entry.reason && <span className="block text-xs text-muted">{entry.reason}</span>}
                                    <span className="block text-xs text-muted tabular-nums">
                                        {formatDate(entry.createdAt)}
                                    </span>
                                </span>
                                <StatusPill tone={STATUS_TONE[entry.status]}>{statusLabel[entry.status]}</StatusPill>
                                <span className="w-16 shrink-0 text-right font-semibold tabular-nums">
                                    {entry.amount > 0 ? '+' : ''}
                                    {entry.amount}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <ActionDialog
                confirmLabel={t('users.detail.dialogs.adjustCoins.confirmLabel')}
                description={t('users.detail.dialogs.adjustCoins.description')}
                fields={[
                    {
                        name: 'amount',
                        label: t('users.detail.dialogs.adjustCoins.amount'),
                        hint: t('users.detail.dialogs.adjustCoins.amountHint'),
                        inputMode: 'numeric',
                        pattern: '-?[1-9][0-9]{0,5}',
                    },
                ]}
                onCancel={() => setAdjusting(false)}
                onConfirm={adjust}
                open={adjusting}
                requireReason
                title={t('users.detail.dialogs.adjustCoins.title')}
            />
        </>
    );
}
