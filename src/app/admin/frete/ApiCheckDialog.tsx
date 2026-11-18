'use client';

import { useState } from 'react';
import { Alert } from '@/components/admin/Alert';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { carrierMoney, kilograms } from '@/types/carrier';
import { yuan, type ShippingRateLine } from '@/types/shipping-table';

/** Amostras padrão: finas até 2 kg (onde fica quase todo pacote), depois mais largas. */
function defaultWeights(maxGrams: number): string {
    const base = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000, 20000, 30000];
    const within = base.filter((weight) => weight <= maxGrams);
    if (!within.includes(maxGrams) && maxGrams <= 30000) within.push(maxGrams);
    return within.join(', ');
}

/**
 * Confere a linha com a API da Westlink e, se o operador quiser, troca a
 * tabela pelos valores cobrados (faixas de peso). A consulta fica gravada na
 * linha para comparar depois.
 */
export function ApiCheckDialog({
    line,
    configured,
    onClose,
    onChanged,
}: {
    line: ShippingRateLine;
    configured: boolean;
    onClose: () => void;
    onChanged: (line: ShippingRateLine) => void;
}) {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [current, setCurrent] = useState(line);
    const [weights, setWeights] = useState(defaultWeights(line.maxWeightGrams));
    const [box, setBox] = useState({
        length: String((line.apiCheck?.lengthMillimeters ?? Math.max(line.minLengthMillimeters ?? 150, 150)) / 10),
        width: String((line.apiCheck?.widthMillimeters ?? Math.max(line.minWidthMillimeters ?? 110, 110)) / 10),
        height: String((line.apiCheck?.heightMillimeters ?? 30) / 10),
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    const check = current.apiCheck;

    const mm = (value: string) => Math.round(Number.parseFloat(value.replace(',', '.')) * 10) || 1;

    async function run() {
        setBusy(true);
        setError(undefined);
        try {
            const updated = await api<ShippingRateLine>(`/shipping-table/lines/${line.id}/api-check`, {
                method: 'POST',
                body: JSON.stringify({
                    weights: weights
                        .split(/[,;\s]+/)
                        .map((entry) => Number.parseInt(entry, 10))
                        .filter((entry) => Number.isFinite(entry) && entry > 0),
                    lengthMillimeters: mm(box.length),
                    widthMillimeters: mm(box.width),
                    heightMillimeters: mm(box.height),
                }),
            });
            setCurrent(updated);
            onChanged(updated);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setBusy(false);
        }
    }

    async function apply() {
        const ok = await confirm({
            title: t('shippingTable.api.apply'),
            description: t('shippingTable.api.applyConfirm', { code: line.code }),
        });
        if (!ok) return;
        setBusy(true);
        setError(undefined);
        try {
            const updated = await api<ShippingRateLine>(`/shipping-table/lines/${line.id}/apply-api-bands`, {
                method: 'POST',
            });
            setCurrent(updated);
            onChanged(updated);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setBusy(false);
        }
    }

    const usable = check?.samples.some((sample) => sample.apiAmountMinor && sample.apiCurrency === 'CNY');

    return (
        <Modal
            closeLabel={t('common.actions.cancel')}
            description={t('shippingTable.api.hint')}
            onClose={onClose}
            open
            size="large"
            title={t('shippingTable.api.title', { code: line.code })}
            footer={
                <div className="flex w-full flex-wrap justify-end gap-2">
                    <Button onClick={onClose} type="button" variant="secondary">
                        {t('common.actions.cancel')}
                    </Button>
                    {usable && (
                        <Button disabled={busy} onClick={apply} type="button" variant="secondary">
                            {t('shippingTable.api.apply')}
                        </Button>
                    )}
                    <Button disabled={!configured} loading={busy} onClick={run} type="button">
                        {t('shippingTable.api.run')}
                    </Button>
                </div>
            }
        >
            <div className="grid gap-4">
                {!configured && (
                    <Alert tone="warning" title={t('carrier.page.notConfiguredTitle')}>
                        <p>{t('shippingTable.api.notConfigured')}</p>
                    </Alert>
                )}
                {error && (
                    <Alert tone="danger" title={t('common.errors.generic')}>
                        <p>{error}</p>
                    </Alert>
                )}
                <Input
                    label={t('shippingTable.api.weights')}
                    onChange={(event) => setWeights(event.target.value)}
                    value={weights}
                />
                <div className="grid grid-cols-3 gap-3">
                    {(['length', 'width', 'height'] as const).map((side) => (
                        <Input
                            inputMode="decimal"
                            key={side}
                            label={t(`shippingTable.simulator.${side}`)}
                            onChange={(event) => setBox((value) => ({ ...value, [side]: event.target.value }))}
                            value={box[side]}
                        />
                    ))}
                </div>

                {check && (
                    <div className="grid gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted dark:text-night-muted">
                            <span>
                                {t('shippingTable.api.last', {
                                    date: new Date(check.checkedAt).toLocaleString('pt-BR'),
                                })}
                            </span>
                            {check.enabledForAccount !== null && (
                                <StatusPill tone={check.enabledForAccount ? 'success' : 'danger'}>
                                    {check.enabledForAccount
                                        ? t('shippingTable.api.enabled', { name: check.accountName ?? line.code })
                                        : t('shippingTable.api.notEnabled')}
                                </StatusPill>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[32rem] border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line text-left text-xs text-muted dark:border-night-line dark:text-night-muted">
                                        <th className="px-3 py-2 font-semibold">{t('shippingTable.api.weight')}</th>
                                        <th className="px-3 py-2 text-right font-semibold">
                                            {t('shippingTable.api.table')}
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold">
                                            {t('shippingTable.api.apiValue')}
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold">
                                            {t('shippingTable.api.diff')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {check.samples.map((sample) => {
                                        const diff =
                                            sample.apiAmountMinor &&
                                            sample.tableAmountMinor &&
                                            sample.apiCurrency === 'CNY'
                                                ? Number(sample.apiAmountMinor) - Number(sample.tableAmountMinor)
                                                : null;
                                        return (
                                            <tr
                                                className="border-b border-line last:border-0 dark:border-night-line"
                                                key={sample.weightGrams}
                                            >
                                                <td className="mm-data px-3 py-2">{kilograms(sample.weightGrams)}</td>
                                                <td className="mm-data px-3 py-2 text-right">
                                                    {yuan(sample.tableAmountMinor)}
                                                </td>
                                                <td className="mm-data px-3 py-2 text-right">
                                                    {sample.error ? (
                                                        <span className="text-origin-600 dark:text-night-coral">
                                                            {sample.error}
                                                        </span>
                                                    ) : sample.apiAmountMinor ? (
                                                        (sample.apiCurrency ?? 'CNY') === 'CNY' ? (
                                                            yuan(sample.apiAmountMinor)
                                                        ) : (
                                                            carrierMoney(
                                                                sample.apiAmountMinor,
                                                                sample.apiCurrency ?? '',
                                                            )
                                                        )
                                                    ) : (
                                                        t('common.dash')
                                                    )}
                                                </td>
                                                <td
                                                    className={`mm-data px-3 py-2 text-right ${
                                                        diff && diff !== 0
                                                            ? 'font-semibold text-amber-700 dark:text-night-warning'
                                                            : ''
                                                    }`}
                                                >
                                                    {diff === null
                                                        ? t('common.dash')
                                                        : `${diff > 0 ? '+' : ''}${yuan(diff)}`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
