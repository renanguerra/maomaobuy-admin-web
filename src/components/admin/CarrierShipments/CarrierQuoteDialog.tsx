'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminPackage } from '@/types/api';
import { CARRIER_CARGO_TYPES, type CarrierCargoType, type CarrierParcel, type CarrierQuote } from '@/types/carrier';
import { CarrierQuoteResults } from './CarrierQuoteResults';

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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

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
                        options={CARRIER_CARGO_TYPES.map((type) => ({
                            value: type,
                            label: t(`carrier.cargo.${type}`),
                        }))}
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
                <div className="mt-4">
                    <CarrierQuoteResults
                        onUse={(line) =>
                            onUse({
                                parcel: quotedParcel,
                                costAmountMinor: line.suggestedCostAmountMinor!,
                                channelCode: line.channelCode,
                            })
                        }
                        quote={quote}
                    />
                </div>
            )}
        </Modal>
    );
}
