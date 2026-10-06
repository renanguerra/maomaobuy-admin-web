'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/LanguageProvider';
import { LOCALE_INTL_TAG } from '@/i18n/locale';
import { cny, type ProfitSummary } from '@/types/api';
import { bucketLabel } from './profit-shared';

const CHART_HEIGHT = 200;

/**
 * Lucro por período em barras a partir do zero: acima é sobra, abaixo é
 * prejuízo. Cor por sinal (polaridade) e o sinal também no texto do
 * tooltip, então a leitura não depende só da cor. A tabela "por período"
 * logo abaixo é a visão em tabela do mesmo dado.
 */
export function ProfitChart({ series }: { series: ProfitSummary['series'] }) {
    const { t, locale } = useTranslation();
    const [active, setActive] = useState<number | null>(null);
    const intlLocale = LOCALE_INTL_TAG[locale];

    const values = series.map((point) => Number(point.profitMinor));
    const max = Math.max(0, ...values);
    const min = Math.min(0, ...values);
    const span = max - min || 1;
    const zeroFromTop = (max / span) * CHART_HEIGHT;
    const labelEvery = Math.max(1, Math.ceil(series.length / 12));
    const extremes = new Set([values.indexOf(Math.max(...values)), values.indexOf(Math.min(...values))]);

    if (series.length === 0)
        return <p className="py-10 text-center text-sm text-muted dark:text-night-muted">{t('profit.chart.empty')}</p>;

    return (
        <figure className="m-0" aria-label={t('profit.chart.title')}>
            <div className="relative" style={{ height: CHART_HEIGHT + 24 }} onMouseLeave={() => setActive(null)}>
                <div
                    className="absolute inset-x-0 border-t border-line"
                    style={{ top: zeroFromTop }}
                    aria-hidden="true"
                />
                <div className="absolute inset-x-0 top-0 flex items-stretch gap-[2px]" style={{ height: CHART_HEIGHT }}>
                    {series.map((point, index) => {
                        const value = values[index];
                        const height = Math.max(Math.abs(value) > 0 ? 2 : 0, (Math.abs(value) / span) * CHART_HEIGHT);
                        const positive = value >= 0;
                        return (
                            <button
                                aria-label={`${bucketLabel(point.bucket, intlLocale)}: ${t('profit.chart.profit')} ${cny(point.profitMinor)}`}
                                className="group relative min-w-0 flex-1 cursor-default bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-primary"
                                key={point.bucket}
                                onBlur={() => setActive(null)}
                                onFocus={() => setActive(index)}
                                onMouseEnter={() => setActive(index)}
                                type="button"
                            >
                                <span
                                    className={`absolute inset-x-[15%] ${positive ? 'rounded-t-[4px] bg-brand-500' : 'rounded-b-[4px] bg-origin-600'} ${active === index ? 'opacity-100' : active === null ? 'opacity-100' : 'opacity-60'}`}
                                    style={
                                        positive ? { top: zeroFromTop - height, height } : { top: zeroFromTop, height }
                                    }
                                />
                                {extremes.has(index) && value !== 0 && series.length > 1 && (
                                    <span
                                        className="mm-data pointer-events-none absolute left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-muted dark:text-night-muted"
                                        style={
                                            positive
                                                ? { top: Math.max(0, zeroFromTop - height - 14) }
                                                : { top: Math.min(CHART_HEIGHT - 12, zeroFromTop + height + 2) }
                                        }
                                    >
                                        {cny(point.profitMinor)}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="absolute inset-x-0 bottom-0 flex gap-[2px]" aria-hidden="true">
                    {series.map((point, index) => (
                        <span
                            className="min-w-0 flex-1 truncate text-center text-[10px] text-muted dark:text-night-muted"
                            key={point.bucket}
                        >
                            {index % labelEvery === 0 ? bucketLabel(point.bucket, intlLocale) : ''}
                        </span>
                    ))}
                </div>
                {active !== null && series[active] && (
                    <div
                        className="pointer-events-none absolute z-10 min-w-44 rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink shadow-md dark:bg-night-raised dark:text-night-text"
                        role="status"
                        style={{
                            left: `${((active + 0.5) / series.length) * 100}%`,
                            top: 0,
                            transform: `translateX(${active > series.length / 2 ? '-105%' : '5%'})`,
                        }}
                    >
                        <p className="m-0 mb-1 font-semibold">{bucketLabel(series[active].bucket, intlLocale)}</p>
                        <TooltipRow label={t('profit.chart.revenue')} value={cny(series[active].revenueMinor)} />
                        <TooltipRow label={t('profit.chart.costs')} value={cny(series[active].costsMinor)} />
                        <TooltipRow
                            label={
                                Number(series[active].profitMinor) >= 0
                                    ? t('profit.chart.profit')
                                    : t('profit.chart.loss')
                            }
                            strong
                            value={cny(series[active].profitMinor)}
                        />
                    </div>
                )}
            </div>
            <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-muted dark:text-night-muted">
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" aria-hidden="true" />
                    {t('profit.chart.profit')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-origin-600" aria-hidden="true" />
                    {t('profit.chart.loss')}
                </span>
            </figcaption>
        </figure>
    );
}

function TooltipRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <p
            className={`m-0 flex justify-between gap-4 ${strong ? 'font-semibold' : 'text-muted dark:text-night-muted'}`}
        >
            <span>{label}</span>
            <span className="mm-data">{value}</span>
        </p>
    );
}
