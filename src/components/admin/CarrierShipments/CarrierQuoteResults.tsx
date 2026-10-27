'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { cny } from '@/types/api';
import {
    carrierMoney,
    kilograms,
    type CarrierChannel,
    type CarrierChannels,
    type CarrierQuote,
    type CarrierQuoteLine,
} from '@/types/carrier';
import { CarrierChannelBadges, CarrierChannelDetails } from './CarrierChannelDetails';

/**
 * As linhas cotadas, da mais barata; as recusadas no fim. Serve à cotação do
 * pacote (com "Usar este custo") e à simulação da aba Transportadoras (sem).
 */
export function CarrierQuoteResults({
    quote,
    onUse,
}: {
    quote: CarrierQuote;
    onUse?: (line: CarrierQuoteLine) => void;
}) {
    const [channels, setChannels] = useState<Map<string, CarrierChannel>>(new Map());
    const [expanded, setExpanded] = useState<string>();

    useEffect(() => {
        api<CarrierChannels>('/carrier-shipments/channels')
            .then((loaded) => setChannels(new Map(loaded.channels.map((channel) => [channel.code, channel]))))
            .catch(() => undefined);
    }, []);

    return (
        <ul className="m-0 grid list-none gap-2 p-0">
            {[...quote.lines]
                .sort((left, right) => sortKey(left) - sortKey(right))
                .map((line) => (
                    <QuoteLine
                        channel={channels.get(line.channelCode)}
                        expanded={expanded === line.channelCode}
                        key={line.channelCode}
                        line={line}
                        onToggle={() =>
                            setExpanded((current) => (current === line.channelCode ? undefined : line.channelCode))
                        }
                        onUse={onUse && (() => line.suggestedCostAmountMinor && onUse(line))}
                    />
                ))}
        </ul>
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
    onUse?: () => void;
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
                        {line.customerAmountMinor && (
                            <Price label={t('carrier.quote.customer')} value={cny(line.customerAmountMinor)} />
                        )}
                        {onUse && (
                            <Button disabled={!line.suggestedCostAmountMinor} onClick={onUse} size="small">
                                {t('carrier.quote.use')}
                            </Button>
                        )}
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
