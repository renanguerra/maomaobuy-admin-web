'use client';

import { useState, type FormEvent } from 'react';
import { Calculator } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { CARRIER_CARGO_TYPES, kilograms, type CarrierCargoType } from '@/types/carrier';
import { yuan, type ShippingSimulation } from '@/types/shipping-table';

/**
 * Simula um volume na tabela inteira: o que cada modalidade ativa mostraria
 * no site e o custo de cada linha (inclusive inativas e de uso interno).
 */
export function ShippingTableSimulator({ modalityNames }: { modalityNames: Map<string, string> }) {
    const { t } = useTranslation();
    const [form, setForm] = useState({ weight: '1000', length: '30', width: '25', height: '10' });
    const [cargoType, setCargoType] = useState<CarrierCargoType>('GENERAL');
    const [result, setResult] = useState<ShippingSimulation>();
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);

    const mm = (value: string) => Math.max(0, Math.round((Number.parseFloat(value.replace(',', '.')) || 0) * 10));

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            setResult(
                await api<ShippingSimulation>('/shipping-table/simulate', {
                    method: 'POST',
                    body: JSON.stringify({
                        weightGrams: Math.max(1, Number.parseInt(form.weight, 10) || 0),
                        lengthMillimeters: mm(form.length),
                        widthMillimeters: mm(form.width),
                        heightMillimeters: mm(form.height),
                        cargoType,
                    }),
                }),
            );
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <SectionCard
            description={t('shippingTable.simulator.hint')}
            icon={<Calculator aria-hidden="true" />}
            title={t('shippingTable.simulator.title')}
        >
            <form className="grid gap-3 sm:grid-cols-[repeat(5,minmax(0,1fr))_auto] sm:items-end" onSubmit={submit}>
                {(['weight', 'length', 'width', 'height'] as const).map((field) => (
                    <Input
                        inputMode="decimal"
                        key={field}
                        label={t(`shippingTable.simulator.${field}`)}
                        onChange={(event) => setForm((value) => ({ ...value, [field]: event.target.value }))}
                        value={form[field]}
                    />
                ))}
                <Select
                    label={t('shippingTable.simulator.cargo')}
                    onChange={(event) => setCargoType(event.target.value as CarrierCargoType)}
                    options={CARRIER_CARGO_TYPES.map((type) => ({ value: type, label: t(`carrier.cargo.${type}`) }))}
                    value={cargoType}
                />
                <Button loading={busy} type="submit">
                    {t('shippingTable.simulator.submit')}
                </Button>
            </form>

            {error && (
                <div className="mt-4">
                    <Alert tone="danger" title={t('common.errors.generic')}>
                        <p>{error}</p>
                    </Alert>
                </div>
            )}

            {result && (
                <div className="mt-5 grid gap-5">
                    {result.modalities.length > 0 && (
                        <div>
                            <h3 className="m-0 mb-2 text-xs font-semibold text-muted uppercase dark:text-night-muted">
                                {t('shippingTable.simulator.site')}
                            </h3>
                            <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
                                {result.modalities.map((row) => (
                                    <li
                                        className="rounded-lg border border-line p-3 dark:border-night-line"
                                        key={row.modalityId}
                                    >
                                        <p className="m-0 text-sm font-semibold text-ink dark:text-night-text">
                                            {row.modalityName}
                                        </p>
                                        {row.freightAmountMinor ? (
                                            <>
                                                <p className="mm-data m-0 mt-1 text-lg font-semibold text-ink dark:text-night-text">
                                                    {yuan(row.freightAmountMinor)}
                                                </p>
                                                <p className="m-0 text-xs text-muted dark:text-night-muted">
                                                    {t('shippingTable.simulator.via', { code: row.lineCode ?? '' })}
                                                    {' · '}
                                                    {t('shippingTable.simulator.cost')} {yuan(row.costAmountMinor)}
                                                    {row.estimatedDays &&
                                                        ` · ${t('carrier.channel.daysValue', row.estimatedDays)}`}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="m-0 mt-1 text-xs text-muted dark:text-night-muted">
                                                {row.rejection}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div>
                        <h3 className="m-0 mb-2 text-xs font-semibold text-muted uppercase dark:text-night-muted">
                            {t('shippingTable.simulator.allLines')}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[40rem] border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line text-left text-xs text-muted dark:border-night-line dark:text-night-muted">
                                        <th className="px-3 py-2 font-semibold">{t('shippingTable.lines.code')}</th>
                                        <th className="px-3 py-2 font-semibold">{t('shippingTable.lines.modality')}</th>
                                        <th className="px-3 py-2 text-right font-semibold">
                                            {t('shippingTable.simulator.chargeable')}
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold">
                                            {t('shippingTable.simulator.cost')}
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold">
                                            {t('shippingTable.simulator.customer')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.lines.map((row) => (
                                        <tr
                                            className="border-b border-line align-top last:border-0 dark:border-night-line"
                                            key={row.lineId}
                                        >
                                            <th className="px-3 py-2 text-left font-normal" scope="row">
                                                <span className="mm-data font-semibold text-ink dark:text-night-text">
                                                    {row.lineCode}
                                                </span>{' '}
                                                <span className="text-muted dark:text-night-muted">{row.lineName}</span>
                                                {!row.isActive && (
                                                    <span className="ml-1.5 align-middle">
                                                        <StatusPill tone="neutral">
                                                            {t('shippingTable.status.inactive')}
                                                        </StatusPill>
                                                    </span>
                                                )}
                                            </th>
                                            <td className="px-3 py-2">
                                                {row.modalityId
                                                    ? (modalityNames.get(row.modalityId) ?? t('common.dash'))
                                                    : t('shippingTable.lines.noModality')}
                                            </td>
                                            {row.quote ? (
                                                <>
                                                    <td className="mm-data px-3 py-2 text-right">
                                                        {kilograms(row.quote.chargeableWeightGrams)}
                                                    </td>
                                                    <td
                                                        className="mm-data px-3 py-2 text-right"
                                                        title={row.quote.breakdown
                                                            .map((part) => `${part.label}: ${yuan(part.amountMinor)}`)
                                                            .join('\n')}
                                                    >
                                                        {yuan(row.quote.amountMinor)}
                                                    </td>
                                                    <td className="mm-data px-3 py-2 text-right font-semibold">
                                                        {yuan(row.quote.freightAmountMinor)}
                                                    </td>
                                                </>
                                            ) : (
                                                <td
                                                    className="px-3 py-2 text-xs text-muted dark:text-night-muted"
                                                    colSpan={3}
                                                >
                                                    {row.rejection ?? t('shippingTable.simulator.noQuote')}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </SectionCard>
    );
}
