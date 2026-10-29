'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Clock, Gift, HandCoins, Megaphone, RotateCcw, ShoppingBag, Wallet } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { DescriptionList } from '@/components/admin/DescriptionList';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { StatCard } from '@/components/admin/StatCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import {
    basisPointsLabel,
    cny,
    formatDate,
    type InfluencerBenefit,
    type InfluencerCommission,
    type InfluencerDefaults,
    type InfluencerDetail,
} from '@/types/api';
import { InfluencerCouponDialog, type InfluencerCouponValues } from '../InfluencerCouponDialog';
import {
    benefitStatusTone,
    commissionStatusTone,
    influencerStatusTone,
    socialProfileUrl,
} from '../influencer-format';

type Dialog =
    | { kind: 'approve' | 'edit' }
    | { kind: 'reject' | 'disable' | 'enable' }
    | { kind: 'dismiss'; benefit: InfluencerBenefit }
    | null;

/**
 * Um influencer: o pedido (redes), a decisão, o cupom com os percentuais, o
 * que ele vendeu e os benefícios de nível. Brinde travado por falta de
 * estoque aparece aqui para o armazém tentar de novo ou dar baixa.
 */
export function InfluencerDetailPage() {
    const params = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { notify } = useToast();
    const [influencer, setInfluencer] = useState<InfluencerDetail>();
    const [defaults, setDefaults] = useState<InfluencerDefaults>();
    const [error, setError] = useState<string>();
    const [dialog, setDialog] = useState<Dialog>(null);
    const [retrying, setRetrying] = useState<string>();

    const load = useCallback(() => {
        api<InfluencerDetail>(`/influencers/${params.id}`)
            .then((detail) => {
                setInfluencer(detail);
                setError(undefined);
            })
            .catch((err) =>
                setError(
                    err instanceof ApiError && err.status === 404
                        ? t('influencers.detail.notFound')
                        : t('influencers.error'),
                ),
            );
    }, [params.id, t]);

    useEffect(() => {
        load();
        api<InfluencerDefaults>('/influencers/defaults')
            .then(setDefaults)
            .catch(() => undefined);
    }, [load]);

    async function post(path: string, body: unknown, feedback: Parameters<typeof t>[0]) {
        const updated = await api<InfluencerDetail>(path, {
            method: path.endsWith(params.id) ? 'PATCH' : 'POST',
            body: JSON.stringify(body),
        });
        setInfluencer(updated);
        setDialog(null);
        notify({ tone: 'success', title: t(feedback) });
    }

    async function submitCoupon(values: InfluencerCouponValues) {
        if (dialog?.kind === 'approve')
            await post(`/influencers/${params.id}/approve`, values, 'influencers.feedback.approved');
        else await post(`/influencers/${params.id}`, values, 'influencers.feedback.updated');
    }

    async function retry(benefit: InfluencerBenefit) {
        setRetrying(benefit.id);
        try {
            await api(`/influencers/benefits/${benefit.id}/retry`, { method: 'POST' });
            notify({ tone: 'success', title: t('influencers.feedback.retried') });
            load();
        } catch (err) {
            notify({ tone: 'danger', title: err instanceof Error ? err.message : t('influencers.actionError') });
        } finally {
            setRetrying(undefined);
        }
    }

    if (error)
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/influencers"
                    backLabel={t('influencers.detail.back')}
                    title={t('influencers.detail.kicker')}
                />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            </div>
        );

    if (!influencer)
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/influencers"
                    backLabel={t('influencers.detail.back')}
                    title={t('common.loading')}
                />
                <SkeletonCards label={t('common.loading')} />
            </div>
        );

    const status = influencer.status;
    const commissionColumns: DataTableColumn<InfluencerCommission>[] = [
        {
            key: 'order',
            header: t('influencers.detail.commissionColumns.order'),
            cell: (row) => (
                <span className="block min-w-0">
                    <Link
                        className="text-sm text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/pedidos/${row.orderId}`}
                    >
                        <span className="mm-data">#{row.orderId.slice(0, 8).toUpperCase()}</span>
                    </Link>
                    <span className="mt-0.5 block truncate text-xs text-muted dark:text-night-muted">
                        {row.productName}
                    </span>
                </span>
            ),
        },
        {
            key: 'buyer',
            header: t('influencers.detail.commissionColumns.buyer'),
            hideBelow: 'md',
            cell: (row) => (
                <Link
                    className="block min-w-0 text-sm text-primary no-underline hover:underline dark:text-night-accent"
                    href={`/admin/usuarios/${row.buyer.id}`}
                >
                    <span className="block truncate">{row.buyer.name}</span>
                </Link>
            ),
        },
        {
            key: 'amount',
            header: t('influencers.detail.commissionColumns.amount'),
            numeric: true,
            cell: (row) => (
                <span className="block">
                    <span className="mm-data block font-semibold">{cny(row.amountMinor)}</span>
                    <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                        {t('influencers.detail.commissionOf', {
                            rate: basisPointsLabel(row.commissionBasisPoints),
                            base: cny(row.baseAmountMinor),
                        })}
                    </span>
                </span>
            ),
        },
        {
            key: 'status',
            header: t('influencers.detail.commissionColumns.status'),
            cell: (row) => (
                <span className="block">
                    <StatusPill tone={commissionStatusTone(row.status)}>
                        {t(`influencers.commissionStatuses.${row.status}`)}
                    </StatusPill>
                    {row.status === 'REVERSED' && (
                        <span className="mt-1 block text-[11px] text-muted dark:text-night-muted">
                            {t('influencers.detail.clawback', {
                                wallet: cny(row.clawbackWalletMinor),
                                debt: cny(row.clawbackDebtMinor),
                            })}
                        </span>
                    )}
                    {row.reversalReason && (
                        <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                            {row.reversalReason}
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'dates',
            header: t('influencers.detail.commissionColumns.dates'),
            hideBelow: 'lg',
            numeric: true,
            cell: (row) => (
                <span className="block text-xs text-muted dark:text-night-muted">
                    <span className="block">{t('influencers.detail.paidOn', { date: formatDate(row.createdAt) })}</span>
                    {row.creditedAt && (
                        <span className="block">
                            {t('influencers.detail.creditedOn', { date: formatDate(row.creditedAt) })}
                        </span>
                    )}
                    {row.packageId && (
                        <Link
                            className="text-primary no-underline hover:underline dark:text-night-accent"
                            href={`/admin/pacotes/${row.packageId}`}
                        >
                            {t('influencers.detail.package')}
                        </Link>
                    )}
                </span>
            ),
        },
    ];

    const benefitColumns: DataTableColumn<InfluencerBenefit>[] = [
        {
            key: 'benefit',
            header: t('influencers.detail.benefitColumns.benefit'),
            cell: (benefit) => (
                <span className="block">
                    <span className="block text-sm font-semibold">
                        {t(`influencers.benefitKinds.${benefit.kind}`)} · {benefit.levelName}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                        {benefit.period === 'LEVEL' ? t('influencers.detail.oncePerLevel') : benefit.period}
                    </span>
                </span>
            ),
        },
        {
            key: 'result',
            header: t('influencers.detail.benefitColumns.result'),
            cell: (benefit) =>
                benefit.coupon ? (
                    <span className="block text-xs">
                        <span className="mm-data block font-semibold">{benefit.coupon.code}</span>
                        <span className="text-muted dark:text-night-muted">
                            {t('coupons.uses', {
                                used: benefit.coupon.usedCount,
                                max: benefit.coupon.maxUses ?? '∞',
                            })}
                            {benefit.coupon.expiresAt &&
                                ` · ${t('coupons.untilDate', { date: formatDate(benefit.coupon.expiresAt) })}`}
                        </span>
                    </span>
                ) : benefit.giftOrderId ? (
                    <Link
                        className="text-sm text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/pedidos/${benefit.giftOrderId}`}
                    >
                        {t('influencers.detail.giftOrder')}
                    </Link>
                ) : (
                    <span className="block text-xs text-muted dark:text-night-muted">
                        {benefit.lastError ?? benefit.dismissReason ?? t('common.dash')}
                    </span>
                ),
        },
        {
            key: 'status',
            header: t('influencers.detail.benefitColumns.status'),
            cell: (benefit) => (
                <StatusPill tone={benefitStatusTone(benefit.status)}>
                    {t(`influencers.benefitStatuses.${benefit.status}`)}
                </StatusPill>
            ),
        },
        {
            key: 'actions',
            header: '',
            card: 'full',
            cell: (benefit) =>
                benefit.status === 'PENDING' ? (
                    <span className="flex flex-wrap justify-end gap-2">
                        <Button
                            loading={retrying === benefit.id}
                            onClick={() => void retry(benefit)}
                            size="small"
                            variant="secondary"
                        >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            {t('influencers.actions.retry')}
                        </Button>
                        <Button onClick={() => setDialog({ kind: 'dismiss', benefit })} size="small" variant="ghost">
                            {t('influencers.actions.dismiss')}
                        </Button>
                    </span>
                ) : null,
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={
                    <div className="flex flex-wrap gap-2">
                        {status === 'PENDING' && (
                            <>
                                <Button onClick={() => setDialog({ kind: 'reject' })} variant="ghost">
                                    {t('influencers.actions.reject')}
                                </Button>
                                <Button onClick={() => setDialog({ kind: 'approve' })}>
                                    {t('influencers.actions.approve')}
                                </Button>
                            </>
                        )}
                        {(status === 'APPROVED' || status === 'DISABLED') && (
                            <Button onClick={() => setDialog({ kind: 'edit' })} variant="secondary">
                                {t('influencers.actions.edit')}
                            </Button>
                        )}
                        {status === 'APPROVED' && (
                            <Button onClick={() => setDialog({ kind: 'disable' })} variant="ghost">
                                {t('influencers.actions.disable')}
                            </Button>
                        )}
                        {status === 'DISABLED' && (
                            <Button onClick={() => setDialog({ kind: 'enable' })}>
                                {t('influencers.actions.enable')}
                            </Button>
                        )}
                    </div>
                }
                backHref="/admin/influencers"
                backLabel={t('influencers.detail.back')}
                badge={
                    <StatusPill tone={influencerStatusTone(status)}>
                        {t(`influencers.statuses.${status}`)}
                    </StatusPill>
                }
                description={
                    <Link
                        className="text-primary no-underline hover:underline dark:text-night-accent"
                        href={`/admin/usuarios/${influencer.user.id}`}
                    >
                        {influencer.user.email}
                    </Link>
                }
                kicker={t('influencers.detail.kicker')}
                title={influencer.user.name}
            />

            {influencer.decisionReason && (
                <Alert
                    tone={status === 'REJECTED' ? 'danger' : 'warning'}
                    title={t(
                        status === 'DISABLED'
                            ? 'influencers.detail.disabledReason'
                            : 'influencers.detail.rejectedReason',
                    )}
                >
                    <p>{influencer.decisionReason}</p>
                </Alert>
            )}

            {influencer.approvedAt && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        hint={t('influencers.detail.stats.creditedHint')}
                        icon={Wallet}
                        label={t('influencers.detail.stats.credited')}
                        tone="success"
                        value={cny(influencer.totals.creditedMinor)}
                    />
                    <StatCard
                        hint={t('influencers.detail.stats.pendingHint')}
                        icon={Clock}
                        label={t('influencers.detail.stats.pending')}
                        tone="brand"
                        value={cny(influencer.totals.pendingMinor)}
                    />
                    <StatCard
                        hint={t('influencers.detail.stats.ordersHint', { paid: influencer.paidOrders })}
                        icon={ShoppingBag}
                        label={t('influencers.detail.stats.orders')}
                        value={String(influencer.qualifiedOrders)}
                    />
                    <StatCard
                        hint={t('influencers.detail.stats.debtHint', {
                            reversed: cny(influencer.totals.reversedMinor),
                        })}
                        icon={HandCoins}
                        label={t('influencers.detail.stats.debt')}
                        tone={influencer.totals.debtMinor !== '0' ? 'danger' : 'neutral'}
                        value={cny(influencer.totals.debtMinor)}
                    />
                </div>
            )}

            <SectionCard title={t('influencers.detail.summary')}>
                <DescriptionList
                    items={[
                        {
                            label: t('influencers.detail.fields.socials'),
                            value: (
                                <span className="grid gap-1">
                                    {influencer.socialHandles.map((social) => {
                                        const url = socialProfileUrl(social.network, social.handle);
                                        const label = `${t(`influencers.networks.${social.network}`)} @${social.handle}`;
                                        return url ? (
                                            <a
                                                className="text-primary no-underline hover:underline dark:text-night-accent"
                                                href={url}
                                                key={label}
                                                rel="noreferrer"
                                                target="_blank"
                                            >
                                                {label}
                                            </a>
                                        ) : (
                                            <span key={label}>{label}</span>
                                        );
                                    })}
                                </span>
                            ),
                            wide: true,
                        },
                        { label: t('influencers.detail.fields.appliedAt'), value: formatDate(influencer.appliedAt) },
                        {
                            label: t('influencers.detail.fields.reviewed'),
                            value: influencer.reviewedAt
                                ? `${formatDate(influencer.reviewedAt)}${influencer.reviewedBy ? ` · ${influencer.reviewedBy.name}` : ''}`
                                : t('common.dash'),
                        },
                        {
                            label: t('influencers.detail.fields.level'),
                            value: influencer.level?.name ?? t('common.dash'),
                        },
                        ...(influencer.coupon
                            ? [
                                  {
                                      label: t('influencers.detail.fields.coupon'),
                                      value: (
                                          <Link
                                              className="mm-data text-primary no-underline hover:underline dark:text-night-accent"
                                              href={`/admin/cupons/${influencer.coupon.id}`}
                                          >
                                              {influencer.coupon.code}
                                          </Link>
                                      ),
                                  },
                                  {
                                      label: t('influencers.detail.fields.discount'),
                                      value: basisPointsLabel(influencer.coupon.discountBasisPoints),
                                      numeric: true,
                                  },
                                  {
                                      label: t('influencers.detail.fields.commission'),
                                      value:
                                          influencer.commissionBasisPoints === null
                                              ? t('influencers.detail.defaultRate', {
                                                    rate: basisPointsLabel(influencer.effectiveCommissionBasisPoints),
                                                })
                                              : basisPointsLabel(influencer.effectiveCommissionBasisPoints),
                                      numeric: true,
                                  },
                                  {
                                      label: t('influencers.detail.fields.perUser'),
                                      value:
                                          influencer.coupon.maxUsesPerUser === null
                                              ? t('coupons.unlimited')
                                              : String(influencer.coupon.maxUsesPerUser),
                                      numeric: true,
                                  },
                                  {
                                      label: t('influencers.detail.fields.couponUses'),
                                      value: String(influencer.coupon.usedCount),
                                      numeric: true,
                                  },
                              ]
                            : []),
                        ...(influencer.previousCoupons.length > 0
                            ? [
                                  {
                                      label: t('influencers.detail.fields.previousCoupons'),
                                      value: influencer.previousCoupons
                                          .map((coupon) => `${coupon.code} (${coupon.usedCount})`)
                                          .join(' · '),
                                      wide: true,
                                  },
                              ]
                            : []),
                    ]}
                />
            </SectionCard>

            {influencer.approvedAt && (
                <>
                    <SectionCard
                        description={t('influencers.detail.benefitsDescription')}
                        flush
                        title={t('influencers.detail.benefits')}
                    >
                        <DataTable
                            caption={t('influencers.detail.benefits')}
                            columns={benefitColumns}
                            loadingLabel={t('common.loading')}
                            minWidth="40rem"
                            rowKey={(benefit) => benefit.id}
                            rows={influencer.benefits}
                            empty={<EmptyState icon={Gift} title={t('influencers.detail.noBenefits')} />}
                        />
                    </SectionCard>

                    <SectionCard
                        description={t('influencers.detail.commissionsDescription')}
                        flush
                        title={t('influencers.detail.commissions')}
                    >
                        <DataTable
                            caption={t('influencers.detail.commissions')}
                            columns={commissionColumns}
                            loadingLabel={t('common.loading')}
                            minWidth="48rem"
                            rowKey={(row) => row.id}
                            rows={influencer.commissions}
                            empty={<EmptyState icon={Megaphone} title={t('influencers.detail.noCommissions')} />}
                        />
                    </SectionCard>
                </>
            )}

            <InfluencerCouponDialog
                defaults={defaults}
                influencer={influencer}
                mode={dialog?.kind === 'edit' ? 'edit' : 'approve'}
                onClose={() => setDialog(null)}
                onSubmit={submitCoupon}
                open={dialog?.kind === 'approve' || dialog?.kind === 'edit'}
            />

            <ActionDialog
                confirmLabel={t('influencers.actions.reject')}
                description={t('influencers.dialogs.rejectDescription')}
                onCancel={() => setDialog(null)}
                onConfirm={(values) =>
                    post(`/influencers/${params.id}/reject`, values, 'influencers.feedback.rejected')
                }
                open={dialog?.kind === 'reject'}
                requireReason
                title={t('influencers.dialogs.rejectTitle')}
                variant="danger"
            />
            <ActionDialog
                confirmLabel={t('influencers.actions.disable')}
                description={t('influencers.dialogs.disableDescription')}
                onCancel={() => setDialog(null)}
                onConfirm={(values) =>
                    post(`/influencers/${params.id}/disable`, values, 'influencers.feedback.disabled')
                }
                open={dialog?.kind === 'disable'}
                requireReason
                title={t('influencers.dialogs.disableTitle')}
                variant="danger"
            />
            <ActionDialog
                confirmLabel={t('influencers.actions.enable')}
                description={t('influencers.dialogs.enableDescription')}
                onCancel={() => setDialog(null)}
                onConfirm={(values) =>
                    post(
                        `/influencers/${params.id}/enable`,
                        { totpCode: values.totpCode },
                        'influencers.feedback.enabled',
                    )
                }
                open={dialog?.kind === 'enable'}
                title={t('influencers.dialogs.enableTitle')}
            />
            <ActionDialog
                confirmLabel={t('influencers.actions.dismiss')}
                description={t('influencers.dialogs.dismissDescription')}
                onCancel={() => setDialog(null)}
                onConfirm={async (values) => {
                    if (dialog?.kind !== 'dismiss') return;
                    await api(`/influencers/benefits/${dialog.benefit.id}/dismiss`, {
                        method: 'POST',
                        body: JSON.stringify({ reason: values.reason }),
                    });
                    setDialog(null);
                    notify({ tone: 'success', title: t('influencers.feedback.dismissed') });
                    load();
                }}
                open={dialog?.kind === 'dismiss'}
                requireReason
                requireTotp={false}
                title={t('influencers.dialogs.dismissTitle')}
            />
        </div>
    );
}
