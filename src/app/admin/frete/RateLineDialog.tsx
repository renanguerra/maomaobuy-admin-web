'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { CARRIER_CARGO_TYPES, type CarrierCargoType } from '@/types/carrier';
import {
    TAX_MODES,
    TRACKING_LEVELS,
    type RatePricing,
    type ShippingRateLine,
    type ShippingTable,
    type TaxMode,
    type TrackingLevel,
} from '@/types/shipping-table';
import { emptyPricing, PricingEditor } from './PricingEditor';

/** Valores já preenchidos ao cadastrar (ex.: linha da conta Westlink). */
export interface RateLinePreset {
    integration?: 'WESTLINK';
    code?: string;
    originalName?: string;
}

/** Campos numéricos como texto: o formulário aceita vazio. */
interface FormState {
    modalityId: string;
    supplierId: string;
    integration: '' | 'WESTLINK';
    code: string;
    name: string;
    originalName: string;
    destinationCountry: string;
    cargoTypes: CarrierCargoType[];
    taxMode: TaxMode;
    trackingLevel: TrackingLevel;
    minWeightGrams: string;
    maxWeightGrams: string;
    roundingGrams: string;
    volumetricDivisor: string;
    volumetricFromGrams: string;
    maxSumCm: string;
    maxSideCm: string;
    minLengthCm: string;
    minWidthCm: string;
    daysMin: string;
    daysMax: string;
    daysNote: string;
    pricing: RatePricing;
    summary: string;
    acceptedGoods: string;
    advantages: string;
    disadvantages: string;
    requirements: string;
    taxDisclaimer: string;
    notes: string;
    isActive: boolean;
    isPreferred: boolean;
}

const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));
const cm = (mm: number | null | undefined) => (mm === null || mm === undefined ? '' : String(mm / 10));

function initialState(line: ShippingRateLine | null, preset: RateLinePreset | undefined): FormState {
    return {
        modalityId: line?.modalityId ?? '',
        supplierId: line?.supplierId ?? '',
        integration: line?.integration ?? preset?.integration ?? '',
        code: line?.code ?? preset?.code ?? '',
        name: line?.name ?? '',
        originalName: line?.originalName ?? preset?.originalName ?? '',
        destinationCountry: line?.destinationCountry ?? 'BR',
        cargoTypes: line?.cargoTypes ?? ['GENERAL'],
        taxMode: line?.taxMode ?? 'RECIPIENT',
        trackingLevel: line?.trackingLevel ?? 'TRACKED',
        minWeightGrams: text(line?.minWeightGrams ?? 50),
        maxWeightGrams: text(line?.maxWeightGrams ?? 2000),
        roundingGrams: text(line?.roundingGrams),
        volumetricDivisor: text(line?.volumetricDivisor),
        volumetricFromGrams: text(line?.volumetricFromGrams),
        maxSumCm: cm(line?.maxSumMillimeters),
        maxSideCm: cm(line?.maxSideMillimeters),
        minLengthCm: cm(line?.minLengthMillimeters),
        minWidthCm: cm(line?.minWidthMillimeters),
        daysMin: text(line?.daysMin ?? 15),
        daysMax: text(line?.daysMax ?? 30),
        daysNote: line?.daysNote ?? '',
        pricing: line?.pricing ?? emptyPricing('PER_KG'),
        summary: line?.summary ?? '',
        acceptedGoods: line?.acceptedGoods ?? '',
        advantages: (line?.advantages ?? []).join('\n'),
        disadvantages: (line?.disadvantages ?? []).join('\n'),
        requirements: (line?.requirements ?? []).join('\n'),
        taxDisclaimer: line?.taxDisclaimer ?? '',
        notes: line?.notes ?? '',
        isActive: line?.isActive ?? true,
        isPreferred: line?.isPreferred ?? false,
    };
}

function intOrNull(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function mmOrNull(centimeters: string): number | null {
    const trimmed = centimeters.trim().replace(',', '.');
    if (trimmed === '') return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? Math.round(parsed * 10) : null;
}

const lines = (value: string) =>
    value
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean);

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <fieldset className="m-0 grid gap-3 border-0 border-t border-line p-0 pt-4 dark:border-night-line">
            <legend className="mb-1 text-xs font-semibold text-muted uppercase dark:text-night-muted">{title}</legend>
            {children}
        </fieldset>
    );
}

export function RateLineDialog({
    line,
    preset,
    table,
    onClose,
    onSaved,
}: {
    /** `null` = nova linha. */
    line: ShippingRateLine | null;
    preset?: RateLinePreset;
    table: ShippingTable;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [form, setForm] = useState<FormState>(() => initialState(line, preset));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((current) => ({ ...current, [key]: value }));
    const optional = (label: string) => `${label} (${t('shippingTable.lineForm.optional')})`;

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(undefined);
        try {
            await api(line ? `/shipping-table/lines/${line.id}` : '/shipping-table/lines', {
                method: line ? 'PUT' : 'POST',
                body: JSON.stringify({
                    modalityId: form.modalityId || null,
                    supplierId: form.supplierId || null,
                    integration: form.integration || null,
                    code: form.code,
                    name: form.name,
                    originalName: form.originalName,
                    destinationCountry: form.destinationCountry,
                    cargoTypes: form.cargoTypes,
                    taxMode: form.taxMode,
                    trackingLevel: form.trackingLevel,
                    minWeightGrams: intOrNull(form.minWeightGrams) ?? 0,
                    maxWeightGrams: intOrNull(form.maxWeightGrams) ?? 0,
                    roundingGrams: intOrNull(form.roundingGrams),
                    volumetricDivisor: intOrNull(form.volumetricDivisor),
                    volumetricFromGrams: intOrNull(form.volumetricFromGrams),
                    maxSumMillimeters: mmOrNull(form.maxSumCm),
                    maxSideMillimeters: mmOrNull(form.maxSideCm),
                    minLengthMillimeters: mmOrNull(form.minLengthCm),
                    minWidthMillimeters: mmOrNull(form.minWidthCm),
                    daysMin: intOrNull(form.daysMin) ?? 0,
                    daysMax: intOrNull(form.daysMax) ?? 0,
                    daysNote: form.daysNote,
                    pricing: form.pricing,
                    summary: form.summary,
                    acceptedGoods: form.acceptedGoods,
                    advantages: lines(form.advantages),
                    disadvantages: lines(form.disadvantages),
                    requirements: lines(form.requirements),
                    taxDisclaimer: form.taxDisclaimer,
                    notes: form.notes,
                    isActive: form.isActive,
                    isPreferred: form.isPreferred,
                }),
            });
            onSaved();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
            setSaving(false);
        }
    }

    async function remove() {
        if (!line) return;
        const ok = await confirm({
            title: t('shippingTable.lineForm.delete'),
            description: t('shippingTable.lineForm.deleteConfirm', { code: line.code }),
            tone: 'danger',
        });
        if (!ok) return;
        setSaving(true);
        try {
            await api(`/shipping-table/lines/${line.id}`, { method: 'DELETE' });
            onSaved();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
            setSaving(false);
        }
    }

    const numberInput = (label: string, key: keyof FormState, props: { required?: boolean; step?: string } = {}) => (
        <Input
            inputMode="decimal"
            label={label}
            min={0}
            onChange={(event) => set(key, event.target.value as never)}
            required={props.required}
            step={props.step ?? '1'}
            type="number"
            value={form[key] as string}
        />
    );

    return (
        <Modal
            closeLabel={t('common.actions.cancel')}
            onClose={onClose}
            open
            size="large"
            title={
                line
                    ? t('shippingTable.lineForm.editTitle', { code: line.code })
                    : t('shippingTable.lineForm.createTitle')
            }
            footer={
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    {line ? (
                        <Button disabled={saving} onClick={remove} size="small" type="button" variant="dangerGhost">
                            {t('shippingTable.lineForm.delete')}
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button onClick={onClose} type="button" variant="secondary">
                            {t('common.actions.cancel')}
                        </Button>
                        <Button form="rate-line-form" loading={saving} type="submit">
                            {t('common.actions.save')}
                        </Button>
                    </div>
                </div>
            }
        >
            <form className="grid gap-5" id="rate-line-form" onSubmit={submit}>
                {error && (
                    <Alert tone="danger" title={t('common.errors.generic')}>
                        <p>{error}</p>
                    </Alert>
                )}

                <Section title={t('shippingTable.lineForm.sectionIdentity')}>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Select
                            label={t('shippingTable.lineForm.modality')}
                            onChange={(event) => set('modalityId', event.target.value)}
                            options={[
                                { value: '', label: t('shippingTable.lineForm.noModality') },
                                ...table.modalities.map((modality) => ({ value: modality.id, label: modality.name })),
                            ]}
                            value={form.modalityId}
                        />
                        <Select
                            label={t('shippingTable.lineForm.supplier')}
                            onChange={(event) => set('supplierId', event.target.value)}
                            options={[
                                { value: '', label: t('shippingTable.lineForm.noSupplier') },
                                ...table.suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
                            ]}
                            value={form.supplierId}
                        />
                        <Select
                            hint={t('shippingTable.lineForm.integrationHint')}
                            label={t('shippingTable.lineForm.integration')}
                            onChange={(event) => set('integration', event.target.value as FormState['integration'])}
                            options={[
                                { value: '', label: t('shippingTable.lineForm.noIntegration') },
                                { value: 'WESTLINK', label: t('shippingTable.lineForm.westlink') },
                            ]}
                            value={form.integration}
                        />
                        <div className="grid grid-cols-[1fr_6rem] gap-3">
                            <Input
                                label={t('shippingTable.lineForm.code')}
                                maxLength={40}
                                onChange={(event) => set('code', event.target.value)}
                                required
                                value={form.code}
                            />
                            <Input
                                label={t('shippingTable.lineForm.country')}
                                maxLength={2}
                                onChange={(event) => set('destinationCountry', event.target.value.toUpperCase())}
                                required
                                value={form.destinationCountry}
                            />
                        </div>
                        <Input
                            label={t('shippingTable.lineForm.name')}
                            maxLength={160}
                            onChange={(event) => set('name', event.target.value)}
                            required
                            value={form.name}
                        />
                        <Input
                            label={optional(t('shippingTable.lineForm.originalName'))}
                            maxLength={200}
                            onChange={(event) => set('originalName', event.target.value)}
                            value={form.originalName}
                        />
                    </div>
                    <div>
                        <p className="m-0 mb-1.5 text-sm font-semibold text-ink dark:text-night-text">
                            {t('shippingTable.lineForm.cargo')}
                        </p>
                        <div className="flex flex-wrap gap-4">
                            {CARRIER_CARGO_TYPES.map((type) => (
                                <Checkbox
                                    checked={form.cargoTypes.includes(type)}
                                    key={type}
                                    label={t(`carrier.cargo.${type}`)}
                                    onChange={(event) =>
                                        set(
                                            'cargoTypes',
                                            event.target.checked
                                                ? [...form.cargoTypes, type]
                                                : form.cargoTypes.filter((entry) => entry !== type),
                                        )
                                    }
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-6">
                        <Checkbox
                            checked={form.isActive}
                            label={t('shippingTable.lineForm.active')}
                            onChange={(event) => set('isActive', event.target.checked)}
                        />
                        <Checkbox
                            checked={form.isPreferred}
                            description={t('shippingTable.lineForm.preferredHint')}
                            label={t('shippingTable.lineForm.preferred')}
                            onChange={(event) => set('isPreferred', event.target.checked)}
                        />
                    </div>
                </Section>

                <Section title={t('shippingTable.lineForm.sectionPrice')}>
                    <PricingEditor onChange={(pricing) => set('pricing', pricing)} value={form.pricing} />
                </Section>

                <Section title={t('shippingTable.lineForm.sectionLimits')}>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {numberInput(t('shippingTable.lineForm.minWeight'), 'minWeightGrams', { required: true })}
                        {numberInput(t('shippingTable.lineForm.maxWeight'), 'maxWeightGrams', { required: true })}
                        {numberInput(optional(t('shippingTable.lineForm.rounding')), 'roundingGrams')}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                            hint={t('shippingTable.lineForm.volumetricHint')}
                            inputMode="numeric"
                            label={optional(t('shippingTable.lineForm.volumetric'))}
                            min={0}
                            onChange={(event) => set('volumetricDivisor', event.target.value)}
                            type="number"
                            value={form.volumetricDivisor}
                        />
                        {numberInput(optional(t('shippingTable.lineForm.volumetricFrom')), 'volumetricFromGrams')}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                        {numberInput(optional(t('shippingTable.lineForm.maxSum')), 'maxSumCm', { step: '0.1' })}
                        {numberInput(optional(t('shippingTable.lineForm.maxSide')), 'maxSideCm', { step: '0.1' })}
                        {numberInput(optional(t('shippingTable.lineForm.minLength')), 'minLengthCm', { step: '0.1' })}
                        {numberInput(optional(t('shippingTable.lineForm.minWidth')), 'minWidthCm', { step: '0.1' })}
                    </div>
                </Section>

                <Section title={t('shippingTable.lineForm.sectionDays')}>
                    <div className="grid gap-3 sm:grid-cols-4">
                        {numberInput(t('shippingTable.lineForm.daysMin'), 'daysMin', { required: true })}
                        {numberInput(t('shippingTable.lineForm.daysMax'), 'daysMax', { required: true })}
                        <Select
                            label={t('shippingTable.lineForm.taxMode')}
                            onChange={(event) => set('taxMode', event.target.value as TaxMode)}
                            options={TAX_MODES.map((mode) => ({ value: mode, label: t(`shippingTable.tax.${mode}`) }))}
                            value={form.taxMode}
                        />
                        <Select
                            label={t('shippingTable.lineForm.tracking')}
                            onChange={(event) => set('trackingLevel', event.target.value as TrackingLevel)}
                            options={TRACKING_LEVELS.map((level) => ({
                                value: level,
                                label: t(`shippingTable.tracking.${level}`),
                            }))}
                            value={form.trackingLevel}
                        />
                    </div>
                    <Input
                        label={optional(t('shippingTable.lineForm.daysNote'))}
                        maxLength={300}
                        onChange={(event) => set('daysNote', event.target.value)}
                        value={form.daysNote}
                    />
                    <Textarea
                        label={optional(t('shippingTable.lineForm.taxDisclaimer'))}
                        maxLength={2000}
                        onChange={(event) => set('taxDisclaimer', event.target.value)}
                        rows={2}
                        value={form.taxDisclaimer}
                    />
                </Section>

                <Section title={t('shippingTable.lineForm.sectionNotes')}>
                    <Textarea
                        label={optional(t('shippingTable.lineForm.summary'))}
                        maxLength={2000}
                        onChange={(event) => set('summary', event.target.value)}
                        rows={2}
                        value={form.summary}
                    />
                    <Textarea
                        label={optional(t('shippingTable.lineForm.acceptedGoods'))}
                        maxLength={2000}
                        onChange={(event) => set('acceptedGoods', event.target.value)}
                        rows={2}
                        value={form.acceptedGoods}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Textarea
                            label={optional(t('shippingTable.lineForm.advantages'))}
                            onChange={(event) => set('advantages', event.target.value)}
                            rows={4}
                            value={form.advantages}
                        />
                        <Textarea
                            label={optional(t('shippingTable.lineForm.disadvantages'))}
                            onChange={(event) => set('disadvantages', event.target.value)}
                            rows={4}
                            value={form.disadvantages}
                        />
                    </div>
                    <Textarea
                        label={optional(t('shippingTable.lineForm.requirements'))}
                        onChange={(event) => set('requirements', event.target.value)}
                        rows={3}
                        value={form.requirements}
                    />
                    <Textarea
                        label={optional(t('shippingTable.lineForm.notes'))}
                        maxLength={5000}
                        onChange={(event) => set('notes', event.target.value)}
                        rows={3}
                        value={form.notes}
                    />
                </Section>
            </form>
        </Modal>
    );
}
