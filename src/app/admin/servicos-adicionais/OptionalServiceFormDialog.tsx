'use client';

import { useState, type FormEvent } from 'react';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import type { OptionalService } from '@/types/api';

const FORM_ID = 'optional-service-form';

export interface OptionalServiceFormValues {
    code: string;
    name: string;
    description: string;
    kind: 'SERVICE' | 'BUNDLE';
    pricingUnit: 'PER_ITEM' | 'PER_PHOTO' | 'PER_ORDER';
    priceCnyMinor: string;
    maxPriceCnyMinor?: string;
    maxQuantity?: number;
    isActive: boolean;
    sortOrder: number;
    totpCode: string;
}

interface OptionalServiceFormDialogProps {
    open: boolean;
    /** Ausente = criação. Presente = edição, e o código fica travado. */
    service?: OptionalService;
    onClose: () => void;
    onSubmit: (values: OptionalServiceFormValues) => Promise<void>;
}

/**
 * Preço é dinheiro, então o formulário pede TOTP como toda ação sensível do
 * painel. O código só é editável na criação: pedidos antigos guardam uma cópia
 * dele e mudá-lo depois quebraria a leitura desses pedidos.
 */
export function OptionalServiceFormDialog({ open, service, onClose, onSubmit }: OptionalServiceFormDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const needsEnrollment = useTotpEnrollmentGate(open, true);

    if (needsEnrollment) {
        return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;
    }

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            onClose={onClose}
            open={open}
            size="medium"
            title={
                service
                    ? t('optionalServices.form.editTitle', { name: service.name })
                    : t('optionalServices.form.createTitle')
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
            {/* Montado só enquanto aberto: reabrir nunca herda o valor ou o
                erro da edição anterior. */}
            {open && <OptionalServiceForm service={service} onSubmit={onSubmit} onSubmittingChange={setSubmitting} />}
        </Modal>
    );
}

function OptionalServiceForm({
    service,
    onSubmit,
    onSubmittingChange,
}: {
    service?: OptionalService;
    onSubmit: (values: OptionalServiceFormValues) => Promise<void>;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [price, setPrice] = useState(service?.priceCnyMinor ?? '0');
    const [maxPrice, setMaxPrice] = useState(service?.maxPriceCnyMinor ?? '');
    const [isActive, setIsActive] = useState(service?.isActive ?? true);
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const maxQuantity = String(data.get('maxQuantity') ?? '').trim();

        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit({
                code: String(data.get('code') ?? '').trim(),
                name: String(data.get('name') ?? '').trim(),
                description: String(data.get('description') ?? '').trim(),
                kind: String(data.get('kind') ?? 'SERVICE') as 'SERVICE' | 'BUNDLE',
                pricingUnit: String(data.get('pricingUnit') ?? 'PER_ITEM') as OptionalServiceFormValues['pricingUnit'],
                priceCnyMinor: price,
                // Vazio é preço fixo, não faixa com teto zero.
                ...(maxPrice && maxPrice !== '0' ? { maxPriceCnyMinor: maxPrice } : {}),
                ...(maxQuantity ? { maxQuantity: Number(maxQuantity) } : {}),
                isActive,
                sortOrder: Number(String(data.get('sortOrder') ?? '0') || 0),
                totpCode: String(data.get('totpCode') ?? ''),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('optionalServices.actionError'));
        } finally {
            onSubmittingChange(false);
        }
    }

    return (
        <form className="grid gap-4 sm:grid-cols-2" id={FORM_ID} onSubmit={handleSubmit}>
            <Input
                className="font-mono"
                defaultValue={service?.code}
                disabled={Boolean(service)}
                hint={service ? undefined : t('optionalServices.form.codeHint')}
                label={t('optionalServices.form.code')}
                name="code"
                required
            />
            <Input defaultValue={service?.name} label={t('optionalServices.form.name')} name="name" required />

            <Textarea
                className="sm:col-span-2"
                defaultValue={service?.description}
                hint={t('optionalServices.form.descriptionHint')}
                label={t('optionalServices.form.description')}
                maxLength={500}
                name="description"
                required
            />

            <Select
                defaultValue={service?.kind ?? 'SERVICE'}
                label={t('optionalServices.form.kind')}
                name="kind"
                options={[
                    { value: 'SERVICE', label: t('optionalServices.kinds.SERVICE') },
                    { value: 'BUNDLE', label: t('optionalServices.kinds.BUNDLE') },
                ]}
            />
            <Select
                defaultValue={service?.pricingUnit ?? 'PER_ITEM'}
                label={t('optionalServices.form.pricingUnit')}
                name="pricingUnit"
                options={[
                    { value: 'PER_ITEM', label: t('optionalServices.pricingUnits.PER_ITEM') },
                    { value: 'PER_PHOTO', label: t('optionalServices.pricingUnits.PER_PHOTO') },
                    { value: 'PER_ORDER', label: t('optionalServices.pricingUnits.PER_ORDER') },
                ]}
            />

            <CurrencyInput
                currency="CNY"
                hint={t('optionalServices.form.priceHint')}
                label={t('optionalServices.form.price')}
                minor={price}
                onMinorChange={setPrice}
                required
            />
            <CurrencyInput
                currency="CNY"
                hint={t('optionalServices.form.maxPriceHint')}
                label={t('optionalServices.form.maxPrice')}
                minor={maxPrice}
                onMinorChange={setMaxPrice}
            />

            <Input
                defaultValue={service?.maxQuantity ?? ''}
                inputMode="numeric"
                label={t('optionalServices.form.maxQuantity')}
                min={1}
                name="maxQuantity"
                type="number"
            />
            <Input
                defaultValue={service?.sortOrder ?? 0}
                inputMode="numeric"
                label={t('optionalServices.form.sortOrder')}
                min={0}
                name="sortOrder"
                type="number"
            />

            <Checkbox
                checked={isActive}
                className="sm:col-span-2"
                label={t('optionalServices.form.isActive')}
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
