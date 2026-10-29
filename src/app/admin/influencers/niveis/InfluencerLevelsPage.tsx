'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Trophy } from 'lucide-react';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { InfluencerLevel } from '@/types/api';
import { GiftPicker, type GiftSelection } from '../../cupons/CouponFormDialog';
import { basisPointsToPercent, percentToBasisPoints } from '../influencer-format';

const FORM_ID = 'influencer-level-form';

type Editing = { level?: InfluencerLevel } | null;

/**
 * A escada de níveis do programa. O nível vem dos pedidos enviados com o
 * cupom; cada nível pode dar cupons de frete por mês e um brinde na subida.
 * Mudar um nível vale daqui para a frente.
 */
export function InfluencerLevelsPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [levels, setLevels] = useState<InfluencerLevel[]>();
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState<Editing>(null);

    useEffect(() => {
        api<InfluencerLevel[]>('/influencers/levels')
            .then(setLevels)
            .catch((err) =>
                setError(
                    err instanceof ApiError && err.status === 403
                        ? t('influencers.forbidden')
                        : t('influencers.levels.error'),
                ),
            );
    }, [t]);

    async function submit(body: Record<string, unknown>) {
        const existing = editing?.level;
        const updated = await api<InfluencerLevel[]>(
            existing ? `/influencers/levels/${existing.id}` : '/influencers/levels',
            { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(body) },
        );
        setLevels(updated);
        setEditing(null);
        notify({ tone: 'success', title: t('influencers.levels.saved') });
    }

    const columns: DataTableColumn<InfluencerLevel>[] = [
        {
            key: 'name',
            header: t('influencers.levels.columns.name'),
            cell: (level) => (
                <span className="block">
                    <span className="block text-sm font-semibold">{level.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                        {t('influencers.levels.fromOrders', { count: level.minOrders })}
                    </span>
                </span>
            ),
        },
        {
            key: 'benefits',
            header: t('influencers.levels.columns.benefits'),
            cell: (level) => (
                <span className="block text-sm">
                    {level.benefitsSummary}
                    {level.benefitsText && (
                        <span className="mt-0.5 block text-[11px] text-muted dark:text-night-muted">
                            {level.benefitsText}
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'count',
            header: t('influencers.levels.columns.influencers'),
            numeric: true,
            hideBelow: 'md',
            cell: (level) => <span className="mm-data">{level.influencerCount}</span>,
        },
        {
            key: 'status',
            header: t('influencers.levels.columns.status'),
            cell: (level) => (
                <StatusPill tone={level.isActive ? 'success' : 'neutral'}>
                    {t(level.isActive ? 'influencers.levels.active' : 'influencers.levels.inactive')}
                </StatusPill>
            ),
        },
        {
            key: 'actions',
            header: '',
            card: 'full',
            cell: (level) => (
                <Button
                    aria-label={t('influencers.actions.edit')}
                    iconOnly
                    onClick={() => setEditing({ level })}
                    size="small"
                    variant="ghost"
                >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={<Button onClick={() => setEditing({})}>{t('influencers.levels.new')}</Button>}
                backHref="/admin/influencers"
                backLabel={t('influencers.detail.back')}
                description={t('influencers.levels.description')}
                kicker={t('influencers.kicker')}
                title={t('influencers.levels.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            <SectionCard flush>
                <DataTable
                    caption={t('influencers.levels.title')}
                    columns={columns}
                    loading={!levels && !error}
                    loadingLabel={t('common.loading')}
                    minWidth="40rem"
                    rowKey={(level) => level.id}
                    rows={levels ?? []}
                    empty={<EmptyState icon={Trophy} title={t('influencers.levels.empty')} />}
                />
            </SectionCard>

            <LevelFormDialog
                level={editing?.level}
                onClose={() => setEditing(null)}
                onSubmit={submit}
                open={editing !== null}
            />
        </div>
    );
}

function LevelFormDialog({
    open,
    level,
    onClose,
    onSubmit,
}: {
    open: boolean;
    level?: InfluencerLevel;
    onClose: () => void;
    onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const needsEnrollment = useTotpEnrollmentGate(open, true);
    if (needsEnrollment) return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            onClose={onClose}
            open={open}
            size="medium"
            title={
                level
                    ? t('influencers.levels.editTitle', { name: level.name })
                    : t('influencers.levels.new')
            }
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form={FORM_ID} loading={submitting} type="submit">
                        {t('common.actions.save')}
                    </Button>
                </>
            }
        >
            {open && <LevelForm level={level} onSubmit={onSubmit} onSubmittingChange={setSubmitting} />}
        </Modal>
    );
}

function LevelForm({
    level,
    onSubmit,
    onSubmittingChange,
}: {
    level?: InfluencerLevel;
    onSubmit: (body: Record<string, unknown>) => Promise<void>;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [shippingEnabled, setShippingEnabled] = useState((level?.shippingUsesPerMonth ?? 0) > 0);
    const [maxDiscount, setMaxDiscount] = useState(level?.shippingMaxDiscountMinor ?? '');
    const [giftEnabled, setGiftEnabled] = useState(Boolean(level?.gift));
    const [gift, setGift] = useState<GiftSelection | null>(
        level?.gift
            ? {
                  productId: level.gift.productId,
                  productName: level.gift.productName,
                  variants: [],
                  variantExternalId: level.giftVariantExternalId ?? '',
              }
            : null,
    );
    const [isActive, setIsActive] = useState(level?.isActive ?? true);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (giftEnabled && !gift) {
            setError(t('coupons.form.giftRequired'));
            return;
        }
        if (giftEnabled && gift && gift.variants.length > 0 && !gift.variantExternalId) {
            setError(t('coupons.form.giftVariantRequired'));
            return;
        }
        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit({
                name: String(data.get('name') ?? '').trim(),
                minOrders: Number(data.get('minOrders') ?? 0),
                benefitsText: String(data.get('benefitsText') ?? '').trim() || null,
                shippingUsesPerMonth: shippingEnabled ? Number(data.get('shippingUses') ?? 1) : 0,
                shippingDiscountBasisPoints: shippingEnabled
                    ? percentToBasisPoints(String(data.get('shippingPercent') ?? '100'))
                    : null,
                shippingMaxDiscountMinor:
                    shippingEnabled && maxDiscount && maxDiscount !== '0' ? maxDiscount : null,
                giftProductId: giftEnabled ? (gift?.productId ?? null) : null,
                giftVariantExternalId: giftEnabled ? gift?.variantExternalId || null : null,
                isActive,
                totpCode: String(data.get('totpCode') ?? ''),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('influencers.actionError'));
        } finally {
            onSubmittingChange(false);
        }
    }

    return (
        <form className="grid gap-4 sm:grid-cols-2" id={FORM_ID} onSubmit={handleSubmit}>
            <Input
                defaultValue={level?.name}
                label={t('influencers.levels.form.name')}
                maxLength={60}
                minLength={2}
                name="name"
                required
            />
            <Input
                defaultValue={level?.minOrders ?? ''}
                hint={t('influencers.levels.form.minOrdersHint')}
                inputMode="numeric"
                label={t('influencers.levels.form.minOrders')}
                min={0}
                name="minOrders"
                required
                type="number"
            />
            <Textarea
                className="sm:col-span-2"
                defaultValue={level?.benefitsText ?? ''}
                hint={t('influencers.levels.form.benefitsTextHint')}
                label={t('influencers.levels.form.benefitsText')}
                maxLength={300}
                name="benefitsText"
                rows={2}
            />

            <Checkbox
                checked={shippingEnabled}
                className="sm:col-span-2"
                label={t('influencers.levels.form.shipping')}
                onChange={(event) => setShippingEnabled(event.target.checked)}
            />
            {shippingEnabled && (
                <>
                    <Input
                        defaultValue={level?.shippingUsesPerMonth || 1}
                        hint={t('influencers.levels.form.shippingUsesHint')}
                        inputMode="numeric"
                        label={t('influencers.levels.form.shippingUses')}
                        max={31}
                        min={1}
                        name="shippingUses"
                        required
                        type="number"
                    />
                    <Input
                        defaultValue={basisPointsToPercent(level?.shippingDiscountBasisPoints ?? 10_000)}
                        hint={t('influencers.levels.form.shippingPercentHint')}
                        inputMode="decimal"
                        label={t('influencers.levels.form.shippingPercent')}
                        max={100}
                        min={0.01}
                        name="shippingPercent"
                        required
                        step={0.01}
                        suffix="%"
                        type="number"
                    />
                    <CurrencyInput
                        className="sm:col-span-2"
                        currency="CNY"
                        hint={t('influencers.levels.form.shippingMaxHint')}
                        label={t('influencers.levels.form.shippingMax')}
                        minor={maxDiscount}
                        onMinorChange={setMaxDiscount}
                    />
                </>
            )}

            <Checkbox
                checked={giftEnabled}
                className="sm:col-span-2"
                label={t('influencers.levels.form.gift')}
                onChange={(event) => setGiftEnabled(event.target.checked)}
            />
            {giftEnabled && (
                <div className="sm:col-span-2">
                    <GiftPicker onChange={setGift} value={gift} />
                </div>
            )}

            <Checkbox
                checked={isActive}
                className="sm:col-span-2"
                label={t('influencers.levels.form.isActive')}
                onChange={(event) => setIsActive(event.target.checked)}
            />
            <Input
                autoComplete="one-time-code"
                inputMode="numeric"
                label={t('common.fields.totpCode')}
                maxLength={6}
                name="totpCode"
                pattern="\d{6}"
                required
            />
            {error && (
                <Alert className="sm:col-span-2" tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
        </form>
    );
}
