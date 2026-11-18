'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { ShippingBox } from '@/types/shipping-box';

const cm = (mm: number | undefined) => (mm === undefined ? '' : String(mm / 10));

function mm(centimeters: string): number {
    const parsed = Number.parseFloat(centimeters.replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed * 10) : 0;
}

function grams(value: string): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function ShippingBoxDialog({
    box,
    onClose,
    onSaved,
}: {
    /** `null` = nova embalagem. */
    box: ShippingBox | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [label, setLabel] = useState(box?.label ?? '');
    const [sides, setSides] = useState({
        length: cm(box?.lengthMm),
        width: cm(box?.widthMm),
        height: cm(box?.heightMm),
    });
    const [emptyWeight, setEmptyWeight] = useState(String(box?.emptyWeightGrams ?? ''));
    const [maxWeight, setMaxWeight] = useState(String(box?.maxGrossWeightGrams ?? 2000));
    const [cost, setCost] = useState(box?.costAmountMinor ?? '0');
    const [hasCost, setHasCost] = useState(box ? box.costAmountMinor !== null : true);
    const [isActive, setIsActive] = useState(box?.isActive ?? true);
    const [notes, setNotes] = useState(box?.notes ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(undefined);
        try {
            await api(box ? `/shipping-boxes/${box.id}` : '/shipping-boxes', {
                method: box ? 'PUT' : 'POST',
                body: JSON.stringify({
                    label,
                    lengthMm: mm(sides.length),
                    widthMm: mm(sides.width),
                    heightMm: mm(sides.height),
                    emptyWeightGrams: grams(emptyWeight),
                    maxGrossWeightGrams: grams(maxWeight),
                    costAmountMinor: hasCost ? cost : null,
                    isActive,
                    notes,
                }),
            });
            onSaved();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
            setSaving(false);
        }
    }

    async function remove() {
        if (!box) return;
        const ok = await confirm({
            title: t('shippingBoxes.form.delete'),
            description: t('shippingBoxes.form.deleteConfirm', { label: box.label }),
            tone: 'danger',
        });
        if (!ok) return;
        setSaving(true);
        try {
            await api(`/shipping-boxes/${box.id}`, { method: 'DELETE' });
            onSaved();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
            setSaving(false);
        }
    }

    return (
        <Modal
            closeLabel={t('common.actions.cancel')}
            onClose={onClose}
            open
            size="medium"
            title={box ? t('shippingBoxes.form.editTitle') : t('shippingBoxes.form.createTitle')}
            footer={
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    {box ? (
                        <Button disabled={saving} onClick={remove} size="small" type="button" variant="dangerGhost">
                            {t('shippingBoxes.form.delete')}
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button onClick={onClose} type="button" variant="secondary">
                            {t('common.actions.cancel')}
                        </Button>
                        <Button form="shipping-box-form" loading={saving} type="submit">
                            {t('common.actions.save')}
                        </Button>
                    </div>
                </div>
            }
        >
            <form className="grid gap-4" id="shipping-box-form" onSubmit={submit}>
                {error && (
                    <Alert tone="danger" title={t('common.errors.generic')}>
                        <p>{error}</p>
                    </Alert>
                )}
                <Input
                    label={t('shippingBoxes.form.label')}
                    maxLength={80}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder={t('shippingBoxes.form.labelPlaceholder')}
                    required
                    value={label}
                />
                <div>
                    <p className="m-0 mb-1.5 text-sm font-semibold text-ink dark:text-night-text">
                        {t('shippingBoxes.form.inner')}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        {(['length', 'width', 'height'] as const).map((side) => (
                            <Input
                                inputMode="decimal"
                                key={side}
                                label={t(`shippingBoxes.form.${side}`)}
                                min={0.1}
                                onChange={(event) => setSides((value) => ({ ...value, [side]: event.target.value }))}
                                required
                                step="0.1"
                                type="number"
                                value={sides[side]}
                            />
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Input
                        hint={t('shippingBoxes.form.emptyWeightHint')}
                        inputMode="numeric"
                        label={t('shippingBoxes.form.emptyWeight')}
                        min={0}
                        onChange={(event) => setEmptyWeight(event.target.value)}
                        required
                        type="number"
                        value={emptyWeight}
                    />
                    <Input
                        hint={t('shippingBoxes.form.maxWeightHint')}
                        inputMode="numeric"
                        label={t('shippingBoxes.form.maxWeight')}
                        min={1}
                        onChange={(event) => setMaxWeight(event.target.value)}
                        required
                        type="number"
                        value={maxWeight}
                    />
                </div>
                <div className="grid gap-2 rounded-lg border border-line p-3 dark:border-night-line">
                    <Checkbox
                        checked={hasCost}
                        description={t('shippingBoxes.form.costHint')}
                        label={t('shippingBoxes.form.hasCost')}
                        onChange={(event) => setHasCost(event.target.checked)}
                    />
                    {hasCost && (
                        <CurrencyInput
                            currency="CNY"
                            label={t('shippingBoxes.form.cost')}
                            minor={cost}
                            onMinorChange={setCost}
                        />
                    )}
                </div>
                <Textarea
                    label={t('shippingBoxes.form.notes')}
                    maxLength={2000}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    value={notes}
                />
                <Checkbox
                    boxed
                    checked={isActive}
                    description={t('shippingBoxes.form.activeHint')}
                    label={t('shippingBoxes.form.active')}
                    onChange={(event) => setIsActive(event.target.checked)}
                />
            </form>
        </Modal>
    );
}
