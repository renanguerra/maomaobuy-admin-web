'use client';

import { useCallback, useEffect, useState } from 'react';
import { LockOpen, Plus, Wallet } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { DescriptionList } from '@/components/admin/DescriptionList';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import { cny, formatDate, type AdminWallet } from '@/types/api';

/**
 * A carteira do cliente para quem atende.
 *
 * Existe por causa do estorno: um chargeback trava a carteira e prende o
 * saldo, e sem esta tela ninguém no painel conseguia nem ver que isso
 * aconteceu — muito menos destravar. O saldo é em fen porque é em yuan que o
 * cliente compra.
 *
 * Também é por aqui que o financeiro credita quem pagou por fora da
 * plataforma: vira uma recarga confirmada no backend, com recibo e extrato.
 */
export function UserWalletCard({ userId }: { userId: string }) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [wallet, setWallet] = useState<AdminWallet>();
    const [error, setError] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    // Uma chave por abertura do diálogo: o clique duplo e a nova tentativa
    // depois de um TOTP errado reusam a mesma, e o backend não credita duas vezes.
    const [creditKey, setCreditKey] = useState<string>();
    const { admin } = useAdminAccountAuth();
    const canCredit = admin?.role === 'FINANCE' || admin?.role === 'SUPERADMIN';

    const load = useCallback(() => {
        api<AdminWallet>(`/finance/users/${userId}/wallet`)
            .then((loaded) => {
                setWallet(loaded);
                setError(false);
            })
            .catch(() => setError(true));
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    async function unlock(values: { totpCode: string; reason: string }) {
        try {
            await api(`/finance/users/${userId}/wallet/unlock`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            setUnlocking(false);
            notify({ tone: 'success', title: t('users.detail.walletSection.unlocked') });
            load();
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('common.errors.generic'));
        }
    }

    async function credit(values: { totpCode: string; reason: string } & Record<string, string>) {
        try {
            const updated = await api<AdminWallet>(`/finance/users/${userId}/wallet/external-top-ups`, {
                method: 'POST',
                body: JSON.stringify({
                    totpCode: values.totpCode,
                    reason: values.reason,
                    creditAmountMinor: values.creditAmountMinor,
                    chargeAmountMinor: values.chargeAmountMinor,
                    idempotencyKey: creditKey,
                }),
            });
            setWallet(updated);
            setCreditKey(undefined);
            notify({ tone: 'success', title: t('users.detail.walletSection.credited') });
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('common.errors.generic'));
        }
    }

    if (error)
        return (
            <SectionCard dense icon={<Wallet aria-hidden="true" />} title={t('users.detail.walletSection.title')}>
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{t('users.detail.walletSection.error')}</p>
                </Alert>
            </SectionCard>
        );

    if (!wallet) return null;

    const locked = wallet.status === 'LOCKED';

    return (
        <>
            <SectionCard
                dense
                description={t('users.detail.walletSection.description')}
                icon={<Wallet aria-hidden="true" />}
                title={t('users.detail.walletSection.title')}
                action={
                    locked ? (
                        <Button
                            leadingIcon={<LockOpen className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setUnlocking(true)}
                            size="small"
                        >
                            {t('users.detail.walletSection.unlockButton')}
                        </Button>
                    ) : (
                        <span className="flex items-center gap-2">
                            <StatusPill tone="success">{t('users.detail.walletSection.active')}</StatusPill>
                            {canCredit && (
                                <Button
                                    leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                    onClick={() => setCreditKey(crypto.randomUUID())}
                                    size="small"
                                    variant="secondary"
                                >
                                    {t('users.detail.walletSection.creditButton')}
                                </Button>
                            )}
                        </span>
                    )
                }
            >
                {locked && (
                    <Alert className="mb-4" tone="warning" title={t('users.detail.walletSection.lockedTitle')}>
                        <p>{wallet.lockReason ?? t('users.detail.walletSection.lockedFallback')}</p>
                        {wallet.lockedAt && (
                            <p>{t('users.detail.walletSection.lockedAt', { date: formatDate(wallet.lockedAt) })}</p>
                        )}
                    </Alert>
                )}

                <DescriptionList
                    items={[
                        {
                            label: t('users.detail.walletSection.available'),
                            value: cny(wallet.availableAmountMinor),
                            numeric: true,
                        },
                        {
                            label: t('users.detail.walletSection.pending'),
                            value: cny(wallet.pendingAmountMinor),
                            numeric: true,
                        },
                        {
                            label: t('users.detail.walletSection.reserved'),
                            value: cny(wallet.reservedAmountMinor),
                            numeric: true,
                        },
                        ...(Number(wallet.debtAmountMinor) > 0
                            ? [
                                  {
                                      label: t('users.detail.walletSection.debt'),
                                      value: cny(wallet.debtAmountMinor),
                                      numeric: true,
                                  },
                              ]
                            : []),
                    ]}
                />
            </SectionCard>

            <ActionDialog
                confirmLabel={t('users.detail.dialogs.creditExternal.confirmLabel')}
                description={t('users.detail.dialogs.creditExternal.description')}
                fields={[
                    {
                        name: 'creditAmountMinor',
                        kind: 'currency',
                        suffix: 'CNY',
                        label: t('users.detail.dialogs.creditExternal.credit'),
                        hint: t('users.detail.dialogs.creditExternal.creditHint'),
                    },
                    {
                        name: 'chargeAmountMinor',
                        kind: 'currency',
                        suffix: 'BRL',
                        label: t('users.detail.dialogs.creditExternal.charge'),
                        hint: t('users.detail.dialogs.creditExternal.chargeHint'),
                    },
                ]}
                onCancel={() => setCreditKey(undefined)}
                onConfirm={credit}
                open={creditKey !== undefined}
                requireReason
                title={t('users.detail.dialogs.creditExternal.title')}
            />

            <ActionDialog
                confirmLabel={t('users.detail.dialogs.unlockWallet.confirmLabel')}
                description={t('users.detail.dialogs.unlockWallet.description')}
                onCancel={() => setUnlocking(false)}
                onConfirm={unlock}
                open={unlocking}
                title={t('users.detail.dialogs.unlockWallet.title')}
            />
        </>
    );
}
