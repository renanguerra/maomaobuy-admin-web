'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny, type AdminPackage } from '@/types/api';
import {
    carrierMoney,
    kilograms,
    type CarrierCargoType,
    type CarrierChannel,
    type CarrierChannels,
    type CarrierParcel,
    type CarrierQuote,
    type CarrierQuoteLine,
} from '@/types/carrier';
import { CarrierChannelBadges, CarrierChannelDetails } from './CarrierChannelDetails';

const CARGO_TYPES: CarrierCargoType[] = ['GENERAL', 'BATTERY_INTERNAL', 'BATTERY_STANDALONE'];

interface CarrierQuoteDialogProps {
    pkg: AdminPackage;
    onClose: () => void;
    /** Escolheu uma linha: a página abre a cotação do pacote já preenchida. */
    onUse: (selection: { parcel: CarrierParcel; costAmountMinor: string; channelCode: string }) => void;
}

/**
 * Cota o pacote nas dez linhas da Westlink: pela tabela (sempre) e pela API
 * (quando ligada). Montado só enquanto aberto — cada abertura parte das
 * medidas atuais do pacote.
 */
export function CarrierQuoteDialog({ pkg, onClose, onUse }: CarrierQuoteDialogProps) {
    const { t } = useTranslation();
    const [parcel, setParcel] = useState({
        weightGrams: pkg.weightGrams ? String(pkg.weightGrams) : '',
        lengthMillimeters: pkg.lengthMillimeters ? String(pkg.lengthMillimeters) : '',
        widthMillimeters: pkg.widthMillimeters ? String(pkg.widthMillimeters) : '',
        heightMillimeters: pkg.heightMillimeters ? String(pkg.heightMillimeters) : '',
    });
    const [cargoType, setCargoType] = useState<CarrierCargoType>('GENERAL');
    const [quote, setQuote] = useState<CarrierQuote>();
    const [quotedParcel, setQuotedParcel] = useState<CarrierParcel>();
    const [channels, setChannels] = useState<Map<string, CarrierChannel>>(new Map());
    const [expanded, setExpanded] = useState<string>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        api<CarrierChannels>('/carrier-shipments/channels')
            .then((loaded) => setChannels(new Map(loaded.channels.map((channel) => [channel.code, channel]))))
            .catch(() => undefined);
    }, []);

    const numbers: CarrierParcel = {
        weightGrams: Number(parcel.weightGrams),
        lengthMillimeters: Number(parcel.lengthMillimeters),
        widthMillimeters: Number(parcel.widthMillimeters),
        heightMillimeters: Number(parcel.heightMillimeters),
    };
    const valid = Object.values(numbers).every((value) => Number.isInteger(value) && value > 0);

    async function submit(event?: FormEvent) {
        event?.preventDefault();
        if (!valid) return;
        setLoading(true);
        setError(undefined);
        try {
            const result = await api<CarrierQuote>(`/packages/${pkg.id}/carrier-quotes`, {
                method: 'POST',
                body: JSON.stringify({ parcel: numbers, cargoType, withApi: true }),
            });
            setQuote(result);
            setQuotedParcel(numbers);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setLoading(false);
        }
    }

    const field = (name: keyof typeof parcel, label: string, suffix: string) => (
        <Input
            inputMode="numeric"
            label={label}
            min={1}
            name={name}
            onChange={(event) => setParcel((current) => ({ ...current, [name]: event.target.value }))}
            required
            suffix={suffix}
            type="number"
            value={parcel[name]}
        />
    );

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('carrier.quote.description')}
            onClose={onClose}
            open
            size="large"
            title={t('carrier.quote.title')}
            footer={
                <Button onClick={onClose} type="button" variant="ghost">
                    {t('carrier.quote.close')}
                </Button>
            }
        >
            <form className="grid gap-3" onSubmit={submit}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {field('weightGrams', t('carrier.quote.weight'), 'g')}
                    {field('lengthMillimeters', t('carrier.quote.length'), 'mm')}
                    {field('widthMillimeters', t('carrier.quote.width'), 'mm')}
                    {field('heightMillimeters', t('carrier.quote.height'), 'mm')}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <Select
                        fieldClassName="min-w-48 flex-1"
                        label={t('carrier.quote.cargoType')}
                        name="cargoType"
                        onChange={(event) => setCargoType(event.target.value as CarrierCargoType)}
                        options={CARGO_TYPES.map((type) => ({ value: type, label: t(`carrier.cargo.${type}`) }))}
                        value={cargoType}
                    />
                    <Button disabled={!valid} loading={loading} type="submit">
                        {quote ? t('carrier.quote.resubmit') : t('carrier.quote.submit')}
                    </Button>
                </div>
            </form>

            {error && (
                <Alert className="mt-4" tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
            {quote && !quote.configured && (
                <Alert className="mt-4" tone="warning">
                    <p>{t('carrier.quote.apiOff')}</p>
                </Alert>
            )}

            {quote && quotedParcel && (
                <ul className="m-0 mt-4 grid list-none gap-2 p-0">
                    {[...quote.lines]
                        .sort((left, right) => sortKey(left) - sortKey(right))
                        .map((line) => (
                            <QuoteLine
                                channel={channels.get(line.channelCode)}
                                expanded={expanded === line.channelCode}
                                key={line.channelCode}
                                line={line}
                                onToggle={() =>
                                    setExpanded((current) =>
                                        current === line.channelCode ? undefined : line.channelCode,
                                    )
                                }
                                onUse={() =>
                                    line.suggestedCostAmountMinor &&
                                    onUse({
                                        parcel: quotedParcel,
                                        costAmountMinor: line.suggestedCostAmountMinor,
                                        channelCode: line.channelCode,
                                    })
                                }
                            />
                        ))}
                </ul>
            )}
        </Modal>
    );
}

/** Linhas que servem primeiro, da mais barata; as recusadas no fim. */
function sortKey(line: CarrierQuoteLine) {
    if (!line.suggestedCostAmountMinor) return Number.MAX_SAFE_INTEGER;
    return Number(line.suggestedCostAmountMinor) - (line.preferred ? 0.5 : 0);
}

function QuoteLine({
    line,
    channel,
    expanded,
    onToggle,
    onUse,
}: {
    line: CarrierQuoteLine;
    channel: CarrierChannel | undefined;
    expanded: boolean;
    onToggle: () => void;
    onUse: () => void;
}) {
    const { t } = useTranslation();
    const rejected = !line.table;

    return (
        <li
            className={`rounded-lg border p-3 ${
                line.preferred ? 'border-brand-300 dark:border-night-accent/40' : 'border-line dark:border-night-line'
            } ${rejected ? 'opacity-70' : ''}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <strong className="mm-data text-sm text-ink dark:text-night-text">{line.channelCode}</strong>
                        <span className="text-sm text-ink dark:text-night-text">{line.channelName}</span>
                        {channel && <CarrierChannelBadges channel={channel} />}
                    </div>
                    {rejected ? (
                        <p className="m-0 text-xs text-origin-700 dark:text-night-coral">
                            {t('carrier.quote.rejected')}: {line.tableRejection}
                        </p>
                    ) : (
                        <p className="m-0 text-xs text-muted dark:text-night-muted">
                            {t('carrier.quote.chargeable', {
                                weight: kilograms(line.table!.chargeableWeightGrams),
                            })}
                        </p>
                    )}
                </div>

                {!rejected && (
                    <div className="flex flex-wrap items-center gap-4">
                        <Price label={t('carrier.quote.table')} value={cny(line.table!.amountMinor)} />
                        <Price
                            label={t('carrier.quote.api')}
                            value={
                                line.api
                                    ? carrierMoney(line.api.amountMinor, line.api.currency)
                                    : line.apiError
                                      ? t('carrier.quote.apiFailed')
                                      : t('common.dash')
                            }
                            tone={line.apiError ? 'danger' : undefined}
                        />
                        <Button disabled={!line.suggestedCostAmountMinor} onClick={onUse} size="small">
                            {t('carrier.quote.use')}
                        </Button>
                    </div>
                )}
            </div>

            {line.apiError && <p className="m-0 mt-2 text-xs text-origin-700 dark:text-night-coral">{line.apiError}</p>}
            {line.api && line.api.currency !== 'CNY' && (
                <p className="m-0 mt-2 text-xs text-muted dark:text-night-muted">
                    {t('carrier.quote.otherCurrency', { currency: line.api.currency })}
                </p>
            )}

            <button
                aria-expanded={expanded}
                className="mt-2 inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-semibold text-primary dark:text-night-accent"
                onClick={onToggle}
                type="button"
            >
                {expanded ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {t('carrier.quote.details')}
            </button>

            {expanded && (
                <div className="mt-3 grid gap-4 border-t border-line pt-3 dark:border-night-line">
                    {line.table && (
                        <div>
                            <h4 className="m-0 mb-1 text-xs font-semibold text-muted uppercase dark:text-night-muted">
                                {t('carrier.quote.breakdown')}
                            </h4>
                            <ul className="m-0 grid list-none gap-1 p-0 text-xs">
                                {line.table.breakdown.map((row) => (
                                    <li className="flex justify-between gap-3" key={row.label}>
                                        <span className="text-muted dark:text-night-muted">{row.label}</span>
                                        <span className="mm-data text-ink dark:text-night-text">
                                            {cny(row.amountMinor)}
                                        </span>
                                    </li>
                                ))}
                                {line.api?.fees.map((fee) => (
                                    <li className="flex justify-between gap-3" key={`api-${fee.name}`}>
                                        <span className="text-muted dark:text-night-muted">
                                            {t('carrier.quote.api')} · {fee.name}
                                        </span>
                                        <span className="mm-data text-ink dark:text-night-text">
                                            {carrierMoney(Math.round(fee.amount * 100), fee.currency)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {channel && <CarrierChannelDetails channel={channel} />}
                </div>
            )}
        </li>
    );
}

function Price({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
    return (
        <div className="grid text-right">
            <span className="text-xs text-muted dark:text-night-muted">{label}</span>
            {tone === 'danger' ? (
                <StatusPill tone="danger">{value}</StatusPill>
            ) : (
                <span className="mm-data text-sm font-semibold text-ink dark:text-night-text">{value}</span>
            )}
        </div>
    );
}
