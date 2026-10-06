'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import {
    COST_CATEGORIES,
    cny,
    money,
    type CostCategory,
    type CostCurrency,
    type CostEntry,
    type CostPreset,
} from '@/types/api';
import { todayIso } from './cost-utils';

const FORM_ID = 'cost-entry-form';

/** Pedido ou caixa a que o custo fica preso; nenhum = custo geral. */
export interface CostTarget {
    orderId?: string;
    packageId?: string;
}

interface CostEntryDialogProps {
    open: boolean;
    entry?: CostEntry;
    target?: CostTarget;
    presets: readonly CostPreset[];
    onClose: () => void;
    onSaved: (entry: CostEntry) => void;
}

export function CostEntryDialog({ open, entry, target, presets, onClose, onSaved }: CostEntryDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    return (
        <Modal
            closeLabel={t('common.closeAria')}
            onClose={onClose}
            open={open}
            size="medium"
            title={entry ? t('profit.entryForm.editTitle') : t('profit.entryForm.createTitle')}
            description={target?.packageId || target?.orderId ? t('profit.entryForm.targetHint') : undefined}
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
            {open && (
                <CostEntryForm
                    entry={entry}
                    onSaved={onSaved}
                    onSubmittingChange={setSubmitting}
                    presets={presets}
                    target={target}
                />
            )}
        </Modal>
    );
}

function CostEntryForm({
    entry,
    target,
    presets,
    onSaved,
    onSubmittingChange,
}: {
    entry?: CostEntry;
    target?: CostTarget;
    presets: readonly CostPreset[];
    onSaved: (entry: CostEntry) => void;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [category, setCategory] = useState<CostCategory>(entry?.category ?? 'PACKAGING');
    const [description, setDescription] = useState(entry?.description ?? '');
    const [quantity, setQuantity] = useState(String(entry?.quantity ?? 1));
    const [unitAmountMinor, setUnitAmountMinor] = useState(entry?.unitAmountMinor ?? '0');
    const [currency, setCurrency] = useState<CostCurrency>(entry?.currency ?? 'CNY');
    const [exchangeRate, setExchangeRate] = useState(entry?.exchangeRate ?? '');
    const [incurredOn, setIncurredOn] = useState(entry?.incurredOn ?? todayIso());
    const [error, setError] = useState<string>();

    function applyPreset(id: string) {
        const preset = presets.find((item) => item.id === id);
        if (!preset) return;
        setCategory(preset.category);
        setDescription(preset.name);
        setUnitAmountMinor(preset.unitAmountMinor);
        setCurrency(preset.currency);
    }

    const total = (BigInt(unitAmountMinor || '0') * BigInt(Number(quantity) > 0 ? Number(quantity) : 0)).toString();

    async function submit(event: FormEvent) {
        event.preventDefault();
        setError(undefined);
        if (unitAmountMinor === '0') {
            setError(t('profit.entryForm.amountRequired'));
            return;
        }
        onSubmittingChange(true);
        try {
            const body = {
                category,
                description: description.trim(),
                quantity: Number(quantity),
                unitAmountMinor,
                currency,
                // Vazio usa a cotação do dia no backend (ou mantém a do lançamento).
                exchangeRate:
                    currency === 'BRL' && exchangeRate.trim() ? exchangeRate.trim().replace(',', '.') : undefined,
                incurredOn,
                ...(entry ? {} : { orderId: target?.orderId, packageId: target?.packageId }),
            };
            const saved = await api<CostEntry>(entry ? `/costs/entries/${entry.id}` : '/costs/entries', {
                method: entry ? 'PATCH' : 'POST',
                body: JSON.stringify(body),
            });
            onSaved(saved);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            onSubmittingChange(false);
        }
    }

    const activePresets = presets.filter((preset) => preset.isActive);

    return (
        <form className="grid gap-4" id={FORM_ID} onSubmit={submit}>
            {error && (
                <Alert tone="danger" title={t('profit.entryForm.errorTitle')}>
                    <p>{error}</p>
                </Alert>
            )}
            {!entry && activePresets.length > 0 && (
                <Select
                    hint={t('profit.entryForm.presetHint')}
                    label={t('profit.entryForm.preset')}
                    onChange={(event) => applyPreset(event.target.value)}
                    options={activePresets.map((preset) => ({
                        value: preset.id,
                        label: `${preset.name} · ${money(preset.unitAmountMinor, preset.currency)}`,
                    }))}
                    placeholderOption={t('profit.entryForm.presetNone')}
                    value=""
                />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                <Select
                    label={t('profit.entryForm.category')}
                    onChange={(event) => setCategory(event.target.value as CostCategory)}
                    options={COST_CATEGORIES.map((value) => ({ value, label: t(`profit.categories.${value}`) }))}
                    required
                    value={category}
                />
                <Input
                    label={t('profit.entryForm.incurredOn')}
                    onChange={(event) => setIncurredOn(event.target.value)}
                    required
                    type="date"
                    value={incurredOn}
                />
            </div>
            <Input
                label={t('profit.entryForm.description')}
                maxLength={300}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('profit.entryForm.descriptionPlaceholder')}
                required
                value={description}
            />
            <div className="grid gap-4 sm:grid-cols-[6rem_1fr_8rem]">
                <Input
                    label={t('profit.entryForm.quantity')}
                    min={1}
                    onChange={(event) => setQuantity(event.target.value)}
                    required
                    step={1}
                    type="number"
                    value={quantity}
                />
                <CurrencyInput
                    currency={currency}
                    label={t('profit.entryForm.unitAmount')}
                    minor={unitAmountMinor}
                    onMinorChange={setUnitAmountMinor}
                    required
                />
                <Select
                    label={t('profit.entryForm.currency')}
                    onChange={(event) => setCurrency(event.target.value as CostCurrency)}
                    options={[
                        { value: 'CNY', label: 'CNY (¥)' },
                        { value: 'BRL', label: 'BRL (R$)' },
                    ]}
                    value={currency}
                />
            </div>
            {currency === 'BRL' && (
                <Input
                    hint={t('profit.entryForm.exchangeRateHint')}
                    inputMode="decimal"
                    label={t('profit.entryForm.exchangeRate')}
                    onChange={(event) => setExchangeRate(event.target.value)}
                    placeholder="0,7800"
                    value={exchangeRate}
                />
            )}
            <p className="m-0 text-sm text-muted dark:text-night-muted">
                {t('profit.entryForm.total', {
                    total: currency === 'CNY' ? cny(total) : money(total, 'BRL'),
                })}
            </p>
        </form>
    );
}
