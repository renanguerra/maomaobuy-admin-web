'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Pencil, TicketPercent } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { DescriptionList } from '@/components/admin/DescriptionList';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny, couponStatus, formatDate, type CouponDetail, type CouponRedemption } from '@/types/api';
import { CouponFormDialog, type CouponFormValues } from '../CouponFormDialog';
import { couponDiscountLabel, couponStatusTone } from '../coupon-format';

/**
 * Um cupom e quem o usou. É a tela do suporte: "por que meu cupom não
 * funcionou?" se responde olhando as regras e os usos lado a lado.
 */
export function CouponDetailPage() {
    const params = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { notify } = useToast();
    const [coupon, setCoupon] = useState<CouponDetail>();
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState(false);

    const load = useCallback(() => {
        api<CouponDetail>(`/coupons/${params.id}`)
            .then((detail) => {
                setCoupon(detail);
                setError(undefined);
            })
            .catch((err) =>
                setError(err instanceof ApiError && err.status === 404 ? t('coupons.detail.notFound') : t('coupons.error')),
            );
    }, [params.id, t]);

    useEffect(() => {
        load();
    }, [load]);

    async function submit(values: CouponFormValues) {
        const { code, scope, discountType, ...editable } = values;
        void code;
        void scope;
        void discountType;
        await api(`/coupons/${params.id}`, { method: 'PATCH', body: JSON.stringify(editable) });
        notify({ tone: 'success', title: t('coupons.updatedFeedback') });
        setEditing(false);
        load();
    }

    if (error)
        return (
            <div className="grid gap-6">
                <PageHeader backHref="/admin/cupons" backLabel={t('coupons.detail.back')} title={t('coupons.detail.kicker')} />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            </div>
        );

    if (!coupon)
        return (
            <div className="grid gap-6">
                <PageHeader backHref="/admin/cupons" backLabel={t('coupons.detail.back')} title={t('common.loading')} />
                <SkeletonCards label={t('common.loading')} />
            </div>
        );

    const status = couponStatus(coupon);

    const redemptionColumns: DataTableColumn<CouponRedemption>[] = [
        {
            key: 'user',
            header: t('coupons.detail.redemptionColumns.user'),
            cell: (redemption) => (
                <Link
                    className="block min-w-0 text-sm text-primary no-underline hover:underline dark:text-night-accent"
                    href={`/admin/usuarios/${redemption.user.id}`}
                >
                    <span className="block truncate font-semibold">{redemption.user.name}</span>
                    <span className="block truncate text-xs text-muted dark:text-night-muted">{redemption.user.email}</span>
                </Link>
            ),
        },
        {
            key: 'reference',
            header: t('coupons.detail.redemptionColumns.reference'),
            cell: (redemption) => {
                const label = t(`coupons.detail.references.${redemption.referenceType}`);
                const short = redemption.referenceId.slice(0, 8).toUpperCase();
                const href =
                    redemption.referenceType === 'order'
                        ? `/admin/pedidos/${redemption.referenceId}`
                        : redemption.referenceType === 'package'
                          ? `/admin/pacotes/${redemption.referenceId}`
                          : null;
                return href ? (
                    <Link className="text-sm text-primary no-underline hover:underline dark:text-night-accent" href={href}>
                        {label} <span className="mm-data">#{short}</span>
                    </Link>
                ) : (
                    <span className="text-sm text-muted dark:text-night-muted">
                        {label} <span className="mm-data">#{short}</span>
                    </span>
                );
            },
        },
        {
            key: 'discount',
            header: t('coupons.detail.redemptionColumns.discount'),
            numeric: true,
            cell: (redemption) => <span className="mm-data font-semibold">−{cny(redemption.discountAmountMinor)}</span>,
        },
        {
            key: 'createdAt',
            header: t('coupons.detail.redemptionColumns.createdAt'),
            hideBelow: 'md',
            numeric: true,
            cell: (redemption) => (
                <span className="text-muted dark:text-night-muted">{formatDate(redemption.createdAt)}</span>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={
                    <Button onClick={() => setEditing(true)} variant="secondary">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        {t('coupons.edit')}
                    </Button>
                }
                backHref="/admin/cupons"
                backLabel={t('coupons.detail.back')}
                badge={<StatusPill tone={couponStatusTone(status)}>{t(`coupons.statuses.${status}`)}</StatusPill>}
                description={coupon.name}
                kicker={t('coupons.detail.kicker')}
                title={<span className="mm-data">{coupon.code}</span>}
            />

            <SectionCard title={t('coupons.detail.summary')}>
                <DescriptionList
                    items={[
                        { label: t('coupons.detail.fields.scope'), value: t(`coupons.scopes.${coupon.scope}`) },
                        {
                            label: t('coupons.detail.fields.discount'),
                            value: `${couponDiscountLabel(coupon)} (${t(`coupons.discountTypes.${coupon.discountType}`)})`,
                            numeric: true,
                        },
                        {
                            label: t('coupons.detail.fields.maxDiscount'),
                            value: coupon.maxDiscountMinor ? cny(coupon.maxDiscountMinor) : t('common.dash'),
                            numeric: true,
                        },
                        {
                            label: t('coupons.detail.fields.minAmount'),
                            value: coupon.minAmountMinor ? cny(coupon.minAmountMinor) : t('common.dash'),
                            numeric: true,
                        },
                        {
                            label: t('coupons.detail.fields.maxUses'),
                            value: coupon.maxUses === null ? t('coupons.unlimited') : String(coupon.maxUses),
                            numeric: true,
                        },
                        { label: t('coupons.detail.fields.maxUsesPerUser'), value: String(coupon.maxUsesPerUser), numeric: true },
                        { label: t('coupons.detail.fields.usedCount'), value: String(coupon.usedCount), numeric: true },
                        {
                            label: t('coupons.detail.fields.validity'),
                            value: [
                                coupon.startsAt ? t('coupons.fromDate', { date: formatDate(coupon.startsAt) }) : null,
                                coupon.expiresAt ? t('coupons.untilDate', { date: formatDate(coupon.expiresAt) }) : null,
                            ]
                                .filter(Boolean)
                                .join(' · ') || t('coupons.noExpiry'),
                        },
                        {
                            label: t('coupons.detail.fields.user'),
                            value: coupon.user ? (
                                <Link
                                    className="text-primary no-underline hover:underline dark:text-night-accent"
                                    href={`/admin/usuarios/${coupon.user.id}`}
                                >
                                    {coupon.user.name} · {coupon.user.email}
                                </Link>
                            ) : (
                                t('coupons.open')
                            ),
                        },
                        {
                            label: t('coupons.detail.fields.description'),
                            value: coupon.description ?? t('common.dash'),
                            wide: true,
                        },
                        { label: t('coupons.detail.fields.createdAt'), value: formatDate(coupon.createdAt) },
                    ]}
                />
            </SectionCard>

            <SectionCard description={t('coupons.detail.redemptionsDescription')} flush title={t('coupons.detail.redemptions')}>
                <DataTable
                    caption={t('coupons.detail.redemptions')}
                    columns={redemptionColumns}
                    loadingLabel={t('common.loading')}
                    minWidth="40rem"
                    rowKey={(redemption) => redemption.id}
                    rows={coupon.redemptions}
                    empty={<EmptyState icon={TicketPercent} title={t('coupons.detail.noRedemptions')} />}
                />
            </SectionCard>

            <CouponFormDialog coupon={coupon} onClose={() => setEditing(false)} onSubmit={submit} open={editing} />
        </div>
    );
}
