'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { SectionCard } from '@/components/admin/SectionCard';
import { Skeleton } from '@/components/admin/Skeleton';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { money } from '@/types/api';
import type { ShippingPerformance, ShippingPerformanceEntry } from '@/types/shipping-table';

const days = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/**
 * O que os envios de verdade mostram, por modalidade: dias entre o despacho e
 * a entrega, e o imposto que os clientes pagaram à Receita. Uso interno; é a
 * base do que o site vai mostrar ao cliente.
 */
export function ShippingPerformanceSection() {
    const { t } = useTranslation();
    const [performance, setPerformance] = useState<ShippingPerformance>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        api<ShippingPerformance>('/shipping-table/performance')
            .then(setPerformance)
            .catch((err) => setError(err instanceof ApiError ? err.message : t('common.errors.generic')));
    }, [t]);

    const isEmpty = performance && performance.overall.deliveries === 0 && performance.overall.taxReported === 0;
    const rows = (performance?.modalities ?? []).filter((entry) => entry.deliveries > 0 || entry.taxReported > 0);

    const cells = (entry: ShippingPerformanceEntry) => (
        <>
            <td className="mm-data px-4 py-2">{entry.deliveries}</td>
            <td className="mm-data px-4 py-2 whitespace-nowrap">
                {entry.averageDays === null
                    ? t('common.dash')
                    : t('shippingTable.performance.daysValue', { count: days(entry.averageDays) })}
            </td>
            <td className="mm-data px-4 py-2 whitespace-nowrap">
                {entry.medianDays === null
                    ? t('common.dash')
                    : t('shippingTable.performance.daysValue', { count: days(entry.medianDays) })}
            </td>
            <td className="mm-data px-4 py-2 whitespace-nowrap">
                {entry.minDays === null || entry.maxDays === null
                    ? t('common.dash')
                    : days(entry.minDays) === days(entry.maxDays)
                      ? t('shippingTable.performance.daysValue', { count: days(entry.minDays) })
                      : t('shippingTable.performance.range', { min: days(entry.minDays), max: days(entry.maxDays) })}
            </td>
            <td className="mm-data px-4 py-2 whitespace-nowrap">
                {entry.taxReported === 0
                    ? t('common.dash')
                    : t('shippingTable.performance.taxedValue', {
                          charged: entry.taxCharged,
                          reported: entry.taxReported,
                      })}
            </td>
            <td className="mm-data px-4 py-2 whitespace-nowrap">
                {entry.averageTaxAmountMinor === null ? t('common.dash') : money(entry.averageTaxAmountMinor, 'BRL')}
            </td>
        </>
    );

    return (
        <SectionCard
            description={t('shippingTable.performance.hint')}
            flush
            icon={<Timer aria-hidden="true" />}
            title={t('shippingTable.performance.title')}
        >
            {error ? (
                <div className="p-4">
                    <Alert tone="danger" title={t('common.errors.loadTitle')}>
                        <p>{error}</p>
                    </Alert>
                </div>
            ) : !performance ? (
                <div className="p-4">
                    <Skeleton className="h-24 w-full rounded-lg" />
                </div>
            ) : isEmpty ? (
                <div className="p-4">
                    <EmptyState title={t('shippingTable.performance.empty')} />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[46rem] border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-line text-left text-xs text-muted dark:border-night-line dark:text-night-muted">
                                <th className="px-4 py-2 font-semibold" scope="col">
                                    {t('shippingTable.performance.modality')}
                                </th>
                                <th className="px-4 py-2 font-semibold" scope="col">
                                    {t('shippingTable.performance.deliveries')}
                                </th>
                                <th className="px-4 py-2 font-semibold" scope="col">
                                    {t('shippingTable.performance.average')}
                                </th>
                                <th className="px-4 py-2 font-semibold" scope="col">
                                    {t('shippingTable.performance.median')}
                                </th>
                                <th className="px-4 py-2 font-semibold" scope="col">
                                    {t('shippingTable.performance.minMax')}
                                </th>
                                <th className="px-4 py-2 font-semibold" scope="col">
                                    {t('shippingTable.performance.taxed')}
                                </th>
                                <th className="px-4 py-2 font-semibold" scope="col">
                                    {t('shippingTable.performance.averageTax')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((entry) => (
                                <tr
                                    className="border-b border-line dark:border-night-line"
                                    key={entry.modalityId ?? 'none'}
                                >
                                    <th className="px-4 py-2 text-left font-semibold" scope="row">
                                        {entry.modalityName ?? t('shippingTable.performance.noModality')}
                                    </th>
                                    {cells(entry)}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-background font-semibold dark:bg-night-soft">
                                <th className="px-4 py-2 text-left" scope="row">
                                    {t('shippingTable.performance.overall')}
                                </th>
                                {cells(performance.overall)}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </SectionCard>
    );
}
