'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { useTotpEnrollmentGate, type ActionDialogField } from '@/components/admin/ActionDialog';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { cny } from '@/types/api';
import { OTHER_RATE_LINE, type ShippingSimulation } from '@/types/shipping-table';

const FORM_ID = 'freight-quote-form';
const SIDES = ['lengthMillimeters', 'widthMillimeters', 'heightMillimeters'] as const;

/** Mesmo formato do `ActionDialog`, para o handler da página servir aos dois. */
export type FreightQuoteValues = { totpCode: string; reason: string } & Record<string, string>;

interface FreightQuoteDialogProps {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel: string;
    destinationCountry: string;
    defaults: {
        weightGrams: number | null;
        lengthMillimeters: number | null;
        widthMillimeters: number | null;
        heightMillimeters: number | null;
        freightCostAmountMinor: string | null;
    };
    /** O campo de linha do `useDispatchFields`: opções e linha sugerida. */
    lineField: ActionDialogField;
    onCancel: () => void;
    onConfirm: (values: FreightQuoteValues) => Promise<void>;
}

type TableCost =
    | { state: 'idle' }
    | { state: 'loading' }
    | { state: 'priced'; amountMinor: string }
    | { state: 'on-request' }
    /** Sob consulta com histórico: o número é referência, não o custo. */
    | { state: 'learned'; amountMinor: string }
    | { state: 'rejected'; reason: string }
    | { state: 'failed' };

/**
 * Cotação do frete do pacote (26/11/2026). Serve para "Cotar" e para
 * "Aprovar e cotar": peso, medidas e linha; o custo vem calculado pela
 * tabela da linha e continua editável. Mexer no custo à mão desliga o
 * cálculo até o peso, as medidas ou a linha mudarem de novo.
 */
export function FreightQuoteDialog(props: FreightQuoteDialogProps) {
    const needsEnrollment = useTotpEnrollmentGate(props.open, true);
    if (!props.open) return null;
    if (needsEnrollment) return <TotpEnrollmentDialog onCancel={props.onCancel} onEnrolled={() => undefined} open />;
    return <FreightQuoteForm {...props} />;
}

function FreightQuoteForm({
    title,
    description,
    confirmLabel,
    destinationCountry,
    defaults,
    lineField,
    onCancel,
    onConfirm,
}: FreightQuoteDialogProps) {
    const { t } = useTranslation();
    const [weight, setWeight] = useState(defaults.weightGrams ? String(defaults.weightGrams) : '');
    const [sides, setSides] = useState<Record<(typeof SIDES)[number], string>>({
        lengthMillimeters: defaults.lengthMillimeters ? String(defaults.lengthMillimeters) : '',
        widthMillimeters: defaults.widthMillimeters ? String(defaults.widthMillimeters) : '',
        heightMillimeters: defaults.heightMillimeters ? String(defaults.heightMillimeters) : '',
    });
    // Vazio = ainda vale a linha sugerida, que pode chegar depois da abertura.
    const [chosenLine, setChosenLine] = useState('');
    const lineId = chosenLine || (lineField.defaultValue ?? '');
    const initialCost = defaults.freightCostAmountMinor ?? '0';
    const [cost, setCost] = useState(initialCost);
    // Custo já informado (cotação anterior ou API da Westlink) não é trocado
    // pela tabela até alguém mexer no peso, nas medidas ou na linha.
    const [autoCost, setAutoCost] = useState(initialCost === '0');
    // A resposta da tabela chega depois: ela lê o valor de agora, não o da
    // hora do pedido (senão um custo digitado no meio era sobrescrito).
    const autoCostRef = useRef(autoCost);
    const [tableResult, setTableResult] = useState<{ key: string; cost: TableCost }>();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    const parcelReady = Number(weight) > 0 && SIDES.every((side) => Number(sides[side]) > 0);
    const lineReady = lineId !== '' && lineId !== OTHER_RATE_LINE;
    const requestKey = [weight, sides.lengthMillimeters, sides.widthMillimeters, sides.heightMillimeters, lineId].join(
        '|',
    );
    const tableCost: TableCost =
        !parcelReady || !lineReady
            ? { state: 'idle' }
            : tableResult?.key === requestKey
              ? tableResult.cost
              : { state: 'loading' };

    useEffect(() => {
        if (!parcelReady || !lineReady) return;
        let current = true;
        const settle = (cost: TableCost) => current && setTableResult({ key: requestKey, cost });
        const timer = setTimeout(() => {
            api<ShippingSimulation>('/shipping-table/simulate', {
                method: 'POST',
                body: JSON.stringify({
                    weightGrams: Number(weight),
                    lengthMillimeters: Number(sides.lengthMillimeters),
                    widthMillimeters: Number(sides.widthMillimeters),
                    heightMillimeters: Number(sides.heightMillimeters),
                    cargoType: 'GENERAL',
                    destinationCountry,
                }),
            })
                .then((simulation) => {
                    if (!current) return;
                    const line = simulation.lines.find((candidate) => candidate.lineId === lineId);
                    if (!line) return settle({ state: 'failed' });
                    if (line.quote && line.quote.estimatedFromSamples !== null)
                        // Linha sob consulta: a equipe informa o valor do fornecedor.
                        settle({ state: 'learned', amountMinor: line.quote.amountMinor });
                    else if (line.quote) {
                        settle({ state: 'priced', amountMinor: line.quote.amountMinor });
                        if (autoCostRef.current) setCost(line.quote.amountMinor);
                    } else if (line.onRequest) settle({ state: 'on-request' });
                    else settle({ state: 'rejected', reason: line.rejection ?? '' });
                })
                .catch(() => settle({ state: 'failed' }));
        }, 400);
        return () => {
            current = false;
            clearTimeout(timer);
        };
        // A chave já resume peso, medidas e linha.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parcelReady, lineReady, requestKey, destinationCountry]);

    function setAuto(value: boolean) {
        autoCostRef.current = value;
        setAutoCost(value);
    }

    function touchParcel() {
        setAuto(true);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSubmitting(true);
        setError(undefined);
        try {
            await onConfirm({
                totpCode: String(data.get('totpCode') ?? ''),
                reason: '',
                weightGrams: weight,
                ...sides,
                freightCostAmountMinor: cost,
                freightRateLineId: lineId,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('actionDialog.error'));
        } finally {
            setSubmitting(false);
        }
    }

    const costHint =
        tableCost.state === 'loading'
            ? t('packages.detail.dialogs.shipment.tableCalculating')
            : tableCost.state === 'priced'
              ? autoCost
                  ? t('packages.detail.dialogs.shipment.tablePriced')
                  : t('packages.detail.dialogs.shipment.tableManual')
              : tableCost.state === 'on-request'
                ? t('packages.detail.dialogs.shipment.tableOnRequest')
                : tableCost.state === 'learned'
                  ? t('packages.detail.dialogs.shipment.tableLearned', { amount: cny(tableCost.amountMinor) })
                  : tableCost.state === 'rejected'
                    ? t('packages.detail.dialogs.shipment.tableRejected', { reason: tableCost.reason })
                    : tableCost.state === 'failed'
                      ? t('packages.detail.dialogs.shipment.tableFailed')
                      : t('packages.detail.dialogs.shipment.amountHint');

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={description}
            onClose={onCancel}
            open
            size="medium"
            title={title}
            footer={
                <>
                    <Button disabled={submitting} onClick={onCancel} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form={FORM_ID} loading={submitting} type="submit">
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <form className="grid gap-4 sm:grid-cols-2" id={FORM_ID} onSubmit={handleSubmit}>
                <Input
                    inputMode="numeric"
                    label={t('packages.detail.dialogs.shipment.weight')}
                    min={1}
                    name="weightGrams"
                    onChange={(event) => {
                        setWeight(event.target.value);
                        touchParcel();
                    }}
                    placeholder="1500"
                    required
                    suffix="g"
                    type="number"
                    value={weight}
                />
                {SIDES.map((side) => (
                    <Input
                        inputMode="numeric"
                        key={side}
                        label={t(
                            side === 'lengthMillimeters'
                                ? 'packages.detail.dialogs.shipment.length'
                                : side === 'widthMillimeters'
                                  ? 'packages.detail.dialogs.shipment.width'
                                  : 'packages.detail.dialogs.shipment.height',
                        )}
                        min={1}
                        name={side}
                        onChange={(event) => {
                            const value = event.target.value;
                            setSides((currentSides) => ({ ...currentSides, [side]: value }));
                            touchParcel();
                        }}
                        required
                        suffix="mm"
                        type="number"
                        value={sides[side]}
                    />
                ))}
                <Select
                    fieldClassName="sm:col-span-2"
                    hint={lineField.hint}
                    label={lineField.label}
                    name="freightRateLineId"
                    onChange={(event) => {
                        setChosenLine(event.target.value);
                        touchParcel();
                    }}
                    options={lineField.options ?? []}
                    placeholderOption={lineField.placeholder}
                    required
                    value={lineId}
                />
                <CurrencyInput
                    currency="CNY"
                    fieldClassName="sm:col-span-2"
                    hint={costHint}
                    label={t('packages.detail.dialogs.shipment.amount')}
                    minor={cost}
                    name="freightCostAmountMinor"
                    onMinorChange={(minor) => {
                        setCost(minor);
                        setAuto(false);
                    }}
                    required
                />
                <Input
                    autoComplete="one-time-code"
                    className="font-mono tracking-[0.3em]"
                    fieldClassName="sm:col-span-2"
                    inputMode="numeric"
                    label={t('common.fields.totpCode')}
                    maxLength={6}
                    minLength={6}
                    name="totpCode"
                    pattern="\d{6}"
                    placeholder="000000"
                    required
                />
                {error && (
                    <Alert className="sm:col-span-2" tone="danger">
                        <p>{error}</p>
                    </Alert>
                )}
            </form>
        </Modal>
    );
}
