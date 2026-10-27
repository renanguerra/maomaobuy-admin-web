'use client';

import { useState, type FormEvent } from 'react';
import { Calculator } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { SectionCard } from '@/components/admin/SectionCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { CARRIER_CARGO_TYPES, type CarrierCargoType, type CarrierQuote } from '@/types/carrier';
import { CarrierQuoteResults } from './CarrierQuoteResults';

const PARCEL_FIELDS = [
    { name: 'weightGrams', labelKey: 'carrier.quote.weight', suffix: 'g', placeholder: '1200' },
    { name: 'lengthMillimeters', labelKey: 'carrier.quote.length', suffix: 'mm', placeholder: '300' },
    { name: 'widthMillimeters', labelKey: 'carrier.quote.width', suffix: 'mm', placeholder: '200' },
    { name: 'heightMillimeters', labelKey: 'carrier.quote.height', suffix: 'mm', placeholder: '100' },
] as const;

type ParcelField = (typeof PARCEL_FIELDS)[number]['name'];

/**
 * Simula o frete sem pacote: medidas, destino e valor declarado digitados à
 * mão, nas mesmas linhas e pelo mesmo cálculo da cotação do pacote. Nada é
 * gravado — serve para responder "quanto fica?" antes de existir caixa.
 */
export function CarrierSimulator() {
    const { t } = useTranslation();
    const [parcel, setParcel] = useState<Record<ParcelField, string>>({
        weightGrams: '',
        lengthMillimeters: '',
        widthMillimeters: '',
        heightMillimeters: '',
    });
    const [destination, setDestination] = useState({ postalCode: '', state: '', city: '' });
    const [declaredValue, setDeclaredValue] = useState('');
    const [cargoType, setCargoType] = useState<CarrierCargoType>('GENERAL');
    const [quote, setQuote] = useState<CarrierQuote>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    const numbers = Object.fromEntries(PARCEL_FIELDS.map(({ name }) => [name, Number(parcel[name])])) as Record<
        ParcelField,
        number
    >;
    const declaredMinor = Math.round(Number(declaredValue.replace(',', '.')) * 100);
    const valid =
        Object.values(numbers).every((value) => Number.isInteger(value) && value > 0) &&
        destination.postalCode.replace(/\D/g, '').length === 8 &&
        destination.state.trim().length > 0 &&
        destination.city.trim().length > 0 &&
        Number.isFinite(declaredMinor) &&
        declaredMinor > 0;

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!valid) return;
        setLoading(true);
        setError(undefined);
        try {
            setQuote(
                await api<CarrierQuote>('/carrier-shipments/simulate', {
                    method: 'POST',
                    body: JSON.stringify({
                        parcel: numbers,
                        cargoType,
                        withApi: true,
                        destination: {
                            countryCode: 'BR',
                            postalCode: destination.postalCode,
                            state: destination.state.trim().toUpperCase(),
                            city: destination.city.trim(),
                        },
                        declaredValueMinor: String(declaredMinor),
                    }),
                }),
            );
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <SectionCard
            description={t('carrier.simulator.description')}
            icon={<Calculator aria-hidden="true" />}
            title={t('carrier.simulator.title')}
        >
            <form className="grid gap-3" onSubmit={submit}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {PARCEL_FIELDS.map(({ name, labelKey, suffix, placeholder }) => (
                        <Input
                            inputMode="numeric"
                            key={name}
                            label={t(labelKey)}
                            min={1}
                            name={name}
                            onChange={(event) => setParcel((current) => ({ ...current, [name]: event.target.value }))}
                            placeholder={placeholder}
                            required
                            suffix={suffix}
                            type="number"
                            value={parcel[name]}
                        />
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1.5fr)]">
                    <Input
                        autoComplete="postal-code"
                        inputMode="numeric"
                        label={t('carrier.simulator.postalCode')}
                        maxLength={9}
                        name="postalCode"
                        onChange={(event) =>
                            setDestination((current) => ({ ...current, postalCode: event.target.value }))
                        }
                        placeholder="01310-100"
                        required
                        value={destination.postalCode}
                    />
                    <Input
                        label={t('carrier.simulator.state')}
                        maxLength={2}
                        name="state"
                        onChange={(event) => setDestination((current) => ({ ...current, state: event.target.value }))}
                        placeholder="SP"
                        required
                        value={destination.state}
                    />
                    <Input
                        fieldClassName="col-span-2 sm:col-span-1"
                        label={t('carrier.simulator.city')}
                        name="city"
                        onChange={(event) => setDestination((current) => ({ ...current, city: event.target.value }))}
                        placeholder="São Paulo"
                        required
                        value={destination.city}
                    />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <Input
                        fieldClassName="min-w-40 flex-1"
                        inputMode="decimal"
                        label={t('carrier.simulator.declared')}
                        name="declaredValue"
                        onChange={(event) => setDeclaredValue(event.target.value)}
                        placeholder="200"
                        suffix="CNY"
                        required
                        value={declaredValue}
                    />
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
                        {quote ? t('carrier.quote.resubmit') : t('carrier.simulator.submit')}
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
            {quote && (
                <div className="mt-4">
                    <CarrierQuoteResults quote={quote} />
                </div>
            )}
        </SectionCard>
    );
}
