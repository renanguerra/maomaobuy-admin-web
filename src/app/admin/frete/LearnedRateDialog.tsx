'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/admin/Alert';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { kilograms } from '@/types/carrier';
import { yuan, type LearnedRate, type LearnedRateSample, type ShippingRateLine } from '@/types/shipping-table';

/** custo = fixo + por kg × kg, em fen. */
function predict(learned: NonNullable<LearnedRate['learnedPricing']>, grams: number): number {
    return Number(learned.fixedMinor) + Number(learned.perKgMinor) * (grams / 1000);
}

const W = 560;
const H = 220;
const PAD = { left: 52, right: 12, top: 12, bottom: 28 };

/** Fretes informados (pontos) e a reta aprendida, na mesma escala. */
function LearnedChart({ data }: { data: LearnedRate }) {
    const { t } = useTranslation();
    const samples = data.samples;
    const learned = data.learnedPricing;
    if (samples.length === 0) return null;
    const maxGrams = Math.max(...samples.map((sample) => sample.chargeableWeightGrams), learned?.maxGrams ?? 0);
    const maxCost = Math.max(
        ...samples.map((sample) => Number(sample.costAmountMinor)),
        learned ? predict(learned, maxGrams) : 0,
    );
    const xMax = maxGrams * 1.05 || 1;
    const yMax = maxCost * 1.1 || 1;
    const x = (grams: number) => PAD.left + (grams / xMax) * (W - PAD.left - PAD.right);
    const y = (minor: number) => H - PAD.bottom - (minor / yMax) * (H - PAD.top - PAD.bottom);
    const yTicks = [0, 0.5, 1].map((share) => share * yMax);
    const xTicks = [0, 0.5, 1].map((share) => share * xMax);

    return (
        <div className="overflow-x-auto">
            <svg
                aria-label={t('shippingTable.learned.chartLabel')}
                className="w-full min-w-[30rem] text-muted dark:text-night-muted"
                role="img"
                viewBox={`0 0 ${W} ${H}`}
            >
                {yTicks.map((tick) => (
                    <g key={`y${tick}`}>
                        <line
                            stroke="currentColor"
                            strokeOpacity={0.2}
                            x1={PAD.left}
                            x2={W - PAD.right}
                            y1={y(tick)}
                            y2={y(tick)}
                        />
                        <text fill="currentColor" fontSize="10" textAnchor="end" x={PAD.left - 6} y={y(tick) + 3}>
                            {yuan(Math.round(tick))}
                        </text>
                    </g>
                ))}
                {xTicks.map((tick) => (
                    <text
                        fill="currentColor"
                        fontSize="10"
                        key={`x${tick}`}
                        textAnchor="middle"
                        x={x(tick)}
                        y={H - PAD.bottom + 16}
                    >
                        {kilograms(Math.round(tick))}
                    </text>
                ))}
                {learned && (
                    <line
                        className="text-primary"
                        stroke="currentColor"
                        strokeWidth={2}
                        x1={x(learned.minGrams)}
                        x2={x(learned.maxGrams)}
                        y1={y(predict(learned, learned.minGrams))}
                        y2={y(predict(learned, learned.maxGrams))}
                    />
                )}
                {samples.map((sample) => (
                    <circle
                        className={
                            sample.excluded
                                ? 'text-muted dark:text-night-muted'
                                : sample.outlier
                                  ? 'text-origin-600 dark:text-night-coral'
                                  : 'text-primary'
                        }
                        cx={x(sample.chargeableWeightGrams)}
                        cy={y(Number(sample.costAmountMinor))}
                        fill={sample.excluded ? 'none' : 'currentColor'}
                        key={sample.packageId}
                        r={4}
                        stroke="currentColor"
                        strokeWidth={1.5}
                    />
                ))}
            </svg>
        </div>
    );
}

/**
 * Preço aprendido de uma linha: os fretes informados nos pacotes, a reta que
 * sai deles e o botão de tirar um frete da conta (valor digitado errado,
 * pacote fora do comum).
 */
export function LearnedRateDialog({
    line,
    canWrite,
    onClose,
    onChanged,
}: {
    line: ShippingRateLine;
    canWrite: boolean;
    onClose: () => void;
    onChanged: () => void;
}) {
    const { t } = useTranslation();
    const [data, setData] = useState<LearnedRate>();
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState<string>();

    const load = useCallback(() => {
        api<LearnedRate>(`/shipping-table/lines/${line.id}/learned`)
            .then((loaded) => {
                setData(loaded);
                setError(undefined);
            })
            .catch((err) => setError(err instanceof ApiError ? err.message : t('common.errors.generic')));
    }, [line.id, t]);

    useEffect(() => load(), [load]);

    async function toggle(sample: LearnedRateSample) {
        setBusy(sample.packageId);
        try {
            const updated = await api<LearnedRate>(`/shipping-table/lines/${line.id}/samples/${sample.packageId}`, {
                method: 'PUT',
                body: JSON.stringify({ excluded: !sample.excluded }),
            });
            setData(updated);
            onChanged();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setBusy(undefined);
        }
    }

    const learned = data?.learnedPricing;
    const needed = data?.minSamples ?? 0;
    const counted = data?.samples.filter((sample) => !sample.excluded && !sample.outlier).length ?? 0;

    return (
        <Modal
            closeLabel={t('shippingTable.learned.close')}
            description={t('shippingTable.learned.description', { days: data?.windowDays ?? 90 })}
            onClose={onClose}
            open
            size="large"
            title={t('shippingTable.learned.title', { code: line.code })}
            footer={
                <div className="flex w-full justify-end">
                    <Button onClick={onClose} type="button" variant="secondary">
                        {t('shippingTable.learned.close')}
                    </Button>
                </div>
            }
        >
            <div className="grid gap-4">
                {error && (
                    <Alert tone="danger" title={t('common.errors.generic')}>
                        <p>{error}</p>
                    </Alert>
                )}
                {data && !data.onRequest && (
                    <Alert tone="info" title={t('shippingTable.learned.notOnRequestTitle')}>
                        <p>{t('shippingTable.learned.notOnRequest')}</p>
                    </Alert>
                )}
                {data?.onRequest && (
                    <div className="grid gap-1 rounded-lg border border-line p-3 text-sm dark:border-night-line">
                        {learned && learned.samples >= needed ? (
                            <>
                                <p className="m-0 font-semibold text-ink dark:text-night-text">
                                    {learned.method === 'LINEAR'
                                        ? t('shippingTable.learned.formulaLinear', {
                                              fixed: yuan(learned.fixedMinor),
                                              perKg: yuan(learned.perKgMinor),
                                          })
                                        : t('shippingTable.learned.formulaPerKg', {
                                              perKg: yuan(learned.perKgMinor),
                                          })}
                                </p>
                                <p className="m-0 text-muted dark:text-night-muted">
                                    {t('shippingTable.learned.range', {
                                        min: kilograms(learned.minGrams),
                                        max: kilograms(learned.maxGrams),
                                        count: learned.samples,
                                    })}
                                </p>
                            </>
                        ) : (
                            <p className="m-0 text-ink dark:text-night-text">
                                {t('shippingTable.learned.notEnough', { count: counted, needed })}
                            </p>
                        )}
                        {learned && learned.outliers > 0 && (
                            <p className="m-0 text-muted dark:text-night-muted">
                                {t('shippingTable.learned.outliers', { count: learned.outliers })}
                            </p>
                        )}
                    </div>
                )}

                {data && <LearnedChart data={data} />}

                {data && data.samples.length === 0 && (
                    <p className="m-0 text-sm text-muted dark:text-night-muted">{t('shippingTable.learned.empty')}</p>
                )}

                {data && data.samples.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[36rem] border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line text-left text-xs text-muted dark:border-night-line dark:text-night-muted">
                                    <th className="px-3 py-2 font-semibold">{t('shippingTable.learned.package')}</th>
                                    <th className="px-3 py-2 font-semibold">{t('shippingTable.learned.date')}</th>
                                    <th className="px-3 py-2 text-right font-semibold">
                                        {t('shippingTable.learned.weight')}
                                    </th>
                                    <th className="px-3 py-2 text-right font-semibold">
                                        {t('shippingTable.learned.cost')}
                                    </th>
                                    <th className="px-3 py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {data.samples.map((sample) => (
                                    <tr
                                        className="border-b border-line last:border-0 dark:border-night-line"
                                        key={sample.packageId}
                                    >
                                        <td className="px-3 py-2">
                                            <a
                                                className="mm-data text-primary hover:underline"
                                                href={`/admin/pacotes/${sample.packageId}`}
                                            >
                                                {sample.packageCode}
                                            </a>
                                            <span className="ml-2 inline-flex gap-1">
                                                {sample.excluded && (
                                                    <StatusPill tone="neutral">
                                                        {t('shippingTable.learned.excluded')}
                                                    </StatusPill>
                                                )}
                                                {sample.outlier && (
                                                    <StatusPill tone="warning">
                                                        {t('shippingTable.learned.outlier')}
                                                    </StatusPill>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-muted dark:text-night-muted">
                                            {new Date(sample.quotedAt).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="mm-data px-3 py-2 text-right whitespace-nowrap">
                                            {kilograms(sample.chargeableWeightGrams)}
                                        </td>
                                        <td className="mm-data px-3 py-2 text-right whitespace-nowrap">
                                            {yuan(sample.costAmountMinor)}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {canWrite && (
                                                <Button
                                                    loading={busy === sample.packageId}
                                                    disabled={busy !== undefined}
                                                    onClick={() => void toggle(sample)}
                                                    size="small"
                                                    type="button"
                                                    variant="ghost"
                                                >
                                                    {sample.excluded
                                                        ? t('shippingTable.learned.include')
                                                        : t('shippingTable.learned.exclude')}
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Modal>
    );
}
