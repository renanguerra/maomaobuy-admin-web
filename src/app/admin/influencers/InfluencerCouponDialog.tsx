'use client';

import { useState, type FormEvent } from 'react';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { Influencer, InfluencerDefaults } from '@/types/api';
import { basisPointsToPercent, percentToBasisPoints } from './influencer-format';

const FORM_ID = 'influencer-coupon-form';

/** Corpo de `POST /influencers/:id/approve` e `PATCH /influencers/:id`. */
export interface InfluencerCouponValues {
    couponCode: string;
    discountBasisPoints: number;
    /** Nulo = volta ao padrão das configurações (só na edição). */
    commissionBasisPoints: number | null;
    /** Nulo = sem limite por pessoa. */
    maxUsesPerUser: number | null;
    totpCode: string;
}

interface InfluencerCouponDialogProps {
    open: boolean;
    mode: 'approve' | 'edit';
    influencer: Influencer;
    defaults: InfluencerDefaults | undefined;
    onClose: () => void;
    onSubmit: (values: InfluencerCouponValues) => Promise<void>;
}

/**
 * Aprovar (cria o cupom) e editar (troca código, desconto, comissão e limite).
 * Desconto e comissão são dinheiro: TOTP. Trocar o código cria outro cupom e
 * desativa o anterior — o formulário avisa.
 */
export function InfluencerCouponDialog({
    open,
    mode,
    influencer,
    defaults,
    onClose,
    onSubmit,
}: InfluencerCouponDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const needsEnrollment = useTotpEnrollmentGate(open, true);

    if (needsEnrollment) return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={mode === 'approve' ? t('influencers.couponForm.approveDescription') : undefined}
            onClose={onClose}
            open={open}
            size="medium"
            title={
                mode === 'approve'
                    ? t('influencers.couponForm.approveTitle', { name: influencer.user.name })
                    : t('influencers.couponForm.editTitle')
            }
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form={FORM_ID} loading={submitting} type="submit">
                        {mode === 'approve' ? t('influencers.actions.approve') : t('common.actions.save')}
                    </Button>
                </>
            }
        >
            {open && (
                <CouponForm
                    defaults={defaults}
                    influencer={influencer}
                    mode={mode}
                    onSubmit={onSubmit}
                    onSubmittingChange={setSubmitting}
                />
            )}
        </Modal>
    );
}

function suggestedCode(influencer: Influencer): string {
    const base = influencer.socialHandles[0]?.handle ?? influencer.user.name.split(' ')[0] ?? '';
    return base
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .toUpperCase()
        .slice(0, 30);
}

function CouponForm({
    mode,
    influencer,
    defaults,
    onSubmit,
    onSubmittingChange,
}: {
    mode: 'approve' | 'edit';
    influencer: Influencer;
    defaults: InfluencerDefaults | undefined;
    onSubmit: (values: InfluencerCouponValues) => Promise<void>;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const coupon = influencer.coupon;
    const initialPerUser = coupon ? coupon.maxUsesPerUser : (defaults?.maxUsesPerUser ?? null);
    const [unlimited, setUnlimited] = useState(initialPerUser === null);
    const [useDefaultCommission, setUseDefaultCommission] = useState(influencer.commissionBasisPoints === null);
    const [code, setCode] = useState(coupon?.code ?? suggestedCode(influencer));
    const [error, setError] = useState<string>();
    const codeChanged = mode === 'edit' && coupon !== null && code.trim().toUpperCase() !== coupon.code;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const perUser = String(data.get('maxUsesPerUser') ?? '').trim();
        const commission = String(data.get('commission') ?? '').trim();
        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit({
                couponCode: code.trim().toUpperCase(),
                discountBasisPoints: percentToBasisPoints(String(data.get('discount') ?? '')),
                commissionBasisPoints: useDefaultCommission || !commission ? null : percentToBasisPoints(commission),
                maxUsesPerUser: unlimited || !perUser ? null : Number(perUser),
                totpCode: String(data.get('totpCode') ?? ''),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('influencers.actionError'));
        } finally {
            onSubmittingChange(false);
        }
    }

    const discountDefault = basisPointsToPercent(coupon?.discountBasisPoints ?? defaults?.discountBasisPoints ?? 500);
    const commissionDefault = basisPointsToPercent(
        influencer.commissionBasisPoints ?? defaults?.commissionBasisPoints ?? 500,
    );

    return (
        <form className="grid gap-4 sm:grid-cols-2" id={FORM_ID} onSubmit={handleSubmit}>
            <Input
                className="mm-data uppercase"
                fieldClassName="sm:col-span-2"
                hint={
                    codeChanged ? t('influencers.couponForm.codeChangeHint') : t('influencers.couponForm.codeHint')
                }
                label={t('influencers.couponForm.code')}
                maxLength={30}
                onChange={(event) => setCode(event.target.value)}
                pattern="[A-Za-z0-9_\-]{3,30}"
                required
                value={code}
            />
            <Input
                defaultValue={discountDefault}
                hint={t('influencers.couponForm.discountHint')}
                inputMode="decimal"
                label={t('influencers.couponForm.discount')}
                max={100}
                min={0.01}
                name="discount"
                required
                step={0.01}
                suffix="%"
                type="number"
            />
            <div className="grid gap-2">
                <Input
                    defaultValue={commissionDefault}
                    disabled={useDefaultCommission}
                    hint={t('influencers.couponForm.commissionHint')}
                    inputMode="decimal"
                    label={t('influencers.couponForm.commission')}
                    max={100}
                    min={0}
                    name="commission"
                    step={0.01}
                    suffix="%"
                    type="number"
                />
                <Checkbox
                    checked={useDefaultCommission}
                    label={t('influencers.couponForm.useDefaultCommission', {
                        value: basisPointsToPercent(defaults?.commissionBasisPoints ?? 500),
                    })}
                    onChange={(event) => setUseDefaultCommission(event.target.checked)}
                />
            </div>
            <div className="grid gap-2 sm:col-span-2">
                <Input
                    defaultValue={initialPerUser ?? ''}
                    disabled={unlimited}
                    inputMode="numeric"
                    label={t('influencers.couponForm.maxUsesPerUser')}
                    min={1}
                    name="maxUsesPerUser"
                    required={!unlimited}
                    type="number"
                />
                <Checkbox
                    checked={unlimited}
                    label={t('influencers.couponForm.unlimited')}
                    onChange={(event) => setUnlimited(event.target.checked)}
                />
            </div>
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
