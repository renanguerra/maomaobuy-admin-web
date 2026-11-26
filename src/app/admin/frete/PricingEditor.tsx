'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { kilograms } from '@/types/carrier';
import { PRICING_KINDS, yuan, type RatePricing, type RatePricingKind } from '@/types/shipping-table';

/** Tabela vazia de cada formato, para trocar de formato sem sobra do anterior. */
export function emptyPricing(kind: RatePricingKind): RatePricing {
    if (kind === 'WEIGHT_BANDS') return { kind, bands: [{ uptoGrams: 500, amountMinor: '0' }], beyond: null };
    if (kind === 'PER_KG') return { kind, ratePerKgMinor: '0', fixedFeeMinor: '0', feeBands: [], beyondFee: null };
    if (kind === 'ON_REQUEST') return { kind, minSamples: 5, windowDays: 90 };
    return { kind, firstGrams: 500, firstAmountMinor: '0', stepGrams: 500, stepAmountMinor: '0' };
}

/** Uma linha curta para a lista: "¥99/kg + ¥22", "5 faixas até 2 kg"… */
export function usePricingSummary() {
    const { t } = useTranslation();
    return (pricing: RatePricing) => {
        if (pricing.kind === 'WEIGHT_BANDS')
            return t('shippingTable.pricing.summaryBands', {
                count: pricing.bands.length,
                max: kilograms(pricing.bands[pricing.bands.length - 1]?.uptoGrams ?? 0),
            });
        if (pricing.kind === 'ON_REQUEST') return t('shippingTable.pricing.summaryOnRequest');
        if (pricing.kind === 'PER_KG') {
            const tiers = pricing.feeBands.length > 0 ? ` (+${pricing.feeBands.length})` : '';
            return `${t('shippingTable.pricing.summaryPerKg', {
                rate: yuan(pricing.ratePerKgMinor),
                fee: yuan(pricing.fixedFeeMinor),
            })}${tiers}`;
        }
        return t('shippingTable.pricing.summaryStep', {
            first: yuan(pricing.firstAmountMinor),
            firstWeight: kilograms(pricing.firstGrams),
            step: yuan(pricing.stepAmountMinor),
            stepWeight: kilograms(pricing.stepGrams),
        });
    };
}

function gramsValue(value: string): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

interface BandRow {
    uptoGrams: number;
    minor: string;
}

/** Lista editável de faixas "até X g → valor". */
function BandsEditor({
    rows,
    onChange,
    amountLabel,
}: {
    rows: BandRow[];
    onChange: (rows: BandRow[]) => void;
    amountLabel: string;
}) {
    const { t } = useTranslation();
    return (
        <div className="grid gap-2">
            {rows.map((row, index) => (
                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2" key={index}>
                    <Input
                        inputMode="numeric"
                        label={t('shippingTable.pricing.upto')}
                        hideLabel={index > 0}
                        min={1}
                        onChange={(event) =>
                            onChange(
                                rows.map((current, position) =>
                                    position === index
                                        ? { ...current, uptoGrams: gramsValue(event.target.value) }
                                        : current,
                                ),
                            )
                        }
                        type="number"
                        value={row.uptoGrams || ''}
                    />
                    <CurrencyInput
                        currency="CNY"
                        label={index === 0 ? amountLabel : undefined}
                        aria-label={amountLabel}
                        minor={row.minor}
                        onMinorChange={(minor) =>
                            onChange(
                                rows.map((current, position) => (position === index ? { ...current, minor } : current)),
                            )
                        }
                    />
                    <Button
                        aria-label={t('shippingTable.pricing.removeBand')}
                        iconOnly
                        leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => onChange(rows.filter((_, position) => position !== index))}
                        size="small"
                        type="button"
                        variant="ghost"
                    />
                </div>
            ))}
            <div>
                <Button
                    leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => {
                        const last = rows[rows.length - 1];
                        onChange([...rows, { uptoGrams: (last?.uptoGrams ?? 0) + 500, minor: last?.minor ?? '0' }]);
                    }}
                    size="small"
                    type="button"
                    variant="secondary"
                >
                    {t('shippingTable.pricing.addBand')}
                </Button>
            </div>
        </div>
    );
}

/** Fração acima da última faixa: liga/desliga, peso e valor. */
function StepEditor({
    label,
    hint,
    value,
    onChange,
}: {
    label: string;
    hint?: string;
    value: { stepGrams: number; minor: string } | null;
    onChange: (value: { stepGrams: number; minor: string } | null) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="grid gap-2">
            <Checkbox
                checked={value !== null}
                description={hint}
                label={label}
                onChange={(event) => onChange(event.target.checked ? { stepGrams: 500, minor: '0' } : null)}
            />
            {value && (
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        inputMode="numeric"
                        label={t('shippingTable.pricing.step')}
                        min={1}
                        onChange={(event) => onChange({ ...value, stepGrams: gramsValue(event.target.value) })}
                        type="number"
                        value={value.stepGrams || ''}
                    />
                    <CurrencyInput
                        currency="CNY"
                        label={t('shippingTable.pricing.stepAmount')}
                        minor={value.minor}
                        onMinorChange={(minor) => onChange({ ...value, minor })}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Editor dos três formatos de tabela que os fornecedores mandam. Valores em
 * yuan (custo); a margem entra só na hora de mostrar ao cliente.
 */
export function PricingEditor({ value, onChange }: { value: RatePricing; onChange: (value: RatePricing) => void }) {
    const { t } = useTranslation();

    return (
        <div className="grid gap-4">
            <Select
                label={t('shippingTable.pricing.kind')}
                onChange={(event) => onChange(emptyPricing(event.target.value as RatePricingKind))}
                options={PRICING_KINDS.map((kind) => ({
                    value: kind,
                    label: t(`shippingTable.pricing.kinds.${kind}`),
                }))}
                value={value.kind}
            />

            {value.kind === 'WEIGHT_BANDS' && (
                <>
                    <BandsEditor
                        amountLabel={t('shippingTable.pricing.amount')}
                        onChange={(rows) =>
                            onChange({
                                ...value,
                                bands: rows.map((row) => ({ uptoGrams: row.uptoGrams, amountMinor: row.minor })),
                            })
                        }
                        rows={value.bands.map((band) => ({ uptoGrams: band.uptoGrams, minor: band.amountMinor }))}
                    />
                    <StepEditor
                        hint={t('shippingTable.pricing.beyondHint')}
                        label={t('shippingTable.pricing.beyond')}
                        onChange={(step) =>
                            onChange({
                                ...value,
                                beyond: step ? { stepGrams: step.stepGrams, stepAmountMinor: step.minor } : null,
                            })
                        }
                        value={
                            value.beyond
                                ? { stepGrams: value.beyond.stepGrams, minor: value.beyond.stepAmountMinor }
                                : null
                        }
                    />
                </>
            )}

            {value.kind === 'PER_KG' && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <CurrencyInput
                            currency="CNY"
                            label={t('shippingTable.pricing.ratePerKg')}
                            minor={value.ratePerKgMinor}
                            onMinorChange={(minor) => onChange({ ...value, ratePerKgMinor: minor })}
                        />
                        <CurrencyInput
                            currency="CNY"
                            label={t('shippingTable.pricing.fixedFee')}
                            minor={value.fixedFeeMinor}
                            onMinorChange={(minor) => onChange({ ...value, fixedFeeMinor: minor })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <p className="m-0 text-sm font-semibold text-ink dark:text-night-text">
                            {t('shippingTable.pricing.feeBands')}
                        </p>
                        <BandsEditor
                            amountLabel={t('shippingTable.pricing.fee')}
                            onChange={(rows) =>
                                onChange({
                                    ...value,
                                    feeBands: rows.map((row) => ({ uptoGrams: row.uptoGrams, feeMinor: row.minor })),
                                    beyondFee: rows.length === 0 ? null : value.beyondFee,
                                })
                            }
                            rows={value.feeBands.map((band) => ({ uptoGrams: band.uptoGrams, minor: band.feeMinor }))}
                        />
                    </div>
                    {value.feeBands.length > 0 && (
                        <StepEditor
                            label={t('shippingTable.pricing.beyondFee')}
                            onChange={(step) =>
                                onChange({
                                    ...value,
                                    beyondFee: step ? { stepGrams: step.stepGrams, stepFeeMinor: step.minor } : null,
                                })
                            }
                            value={
                                value.beyondFee
                                    ? { stepGrams: value.beyondFee.stepGrams, minor: value.beyondFee.stepFeeMinor }
                                    : null
                            }
                        />
                    )}
                </>
            )}

            {value.kind === 'ON_REQUEST' && (
                <div className="grid gap-2">
                    <p className="m-0 text-sm text-muted dark:text-night-muted">
                        {t('shippingTable.pricing.onRequestHint')}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            inputMode="numeric"
                            label={t('shippingTable.pricing.minSamples')}
                            max={100}
                            min={2}
                            onChange={(event) => onChange({ ...value, minSamples: gramsValue(event.target.value) })}
                            type="number"
                            value={value.minSamples || ''}
                        />
                        <Input
                            inputMode="numeric"
                            label={t('shippingTable.pricing.windowDays')}
                            max={730}
                            min={7}
                            onChange={(event) => onChange({ ...value, windowDays: gramsValue(event.target.value) })}
                            type="number"
                            value={value.windowDays || ''}
                        />
                    </div>
                </div>
            )}

            {value.kind === 'FIRST_PLUS_STEP' && (
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        inputMode="numeric"
                        label={t('shippingTable.pricing.firstGrams')}
                        min={1}
                        onChange={(event) => onChange({ ...value, firstGrams: gramsValue(event.target.value) })}
                        type="number"
                        value={value.firstGrams || ''}
                    />
                    <CurrencyInput
                        currency="CNY"
                        label={t('shippingTable.pricing.firstAmount')}
                        minor={value.firstAmountMinor}
                        onMinorChange={(minor) => onChange({ ...value, firstAmountMinor: minor })}
                    />
                    <Input
                        inputMode="numeric"
                        label={t('shippingTable.pricing.stepGrams')}
                        min={1}
                        onChange={(event) => onChange({ ...value, stepGrams: gramsValue(event.target.value) })}
                        type="number"
                        value={value.stepGrams || ''}
                    />
                    <CurrencyInput
                        currency="CNY"
                        label={t('shippingTable.pricing.stepAmountLabel')}
                        minor={value.stepAmountMinor}
                        onMinorChange={(minor) => onChange({ ...value, stepAmountMinor: minor })}
                    />
                </div>
            )}
        </div>
    );
}
