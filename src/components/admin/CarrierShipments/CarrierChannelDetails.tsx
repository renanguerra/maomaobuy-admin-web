'use client';

import { StatusPill } from '@/components/admin/StatusPill';
import { useTranslation } from '@/i18n/LanguageProvider';
import { kilograms, type CarrierChannel } from '@/types/carrier';

/**
 * Tudo o que a tabela da Westlink diz de uma linha: limites, prazo, o que
 * aceita, prós e contras, exigências e a ressalva de imposto. Os textos vêm
 * do backend (fonte única da tabela); aqui só se organiza.
 */
export function CarrierChannelDetails({ channel }: { channel: CarrierChannel }) {
    const { t } = useTranslation();

    const facts: { label: string; value: string }[] = [
        {
            label: t('carrier.channel.weight'),
            value: t('carrier.channel.weightRange', {
                min: kilograms(channel.minWeightGrams),
                max: kilograms(channel.maxWeightGrams),
            }),
        },
        {
            label: t('carrier.channel.volumetric'),
            value: channel.volumetricDivisor
                ? t('carrier.channel.volumetricValue', { divisor: channel.volumetricDivisor })
                : t('carrier.channel.noVolumetric'),
        },
        ...(channel.maxSideMillimeters && channel.maxSumMillimeters
            ? [
                  {
                      label: t('carrier.channel.size'),
                      value: [
                          t('carrier.channel.sizeValue', {
                              side: channel.maxSideMillimeters / 10,
                              sum: channel.maxSumMillimeters / 10,
                          }),
                          channel.minimumSize
                              ? t('carrier.channel.minSize', {
                                    length: channel.minimumSize.lengthMillimeters / 10,
                                    width: channel.minimumSize.widthMillimeters / 10,
                                })
                              : '',
                      ]
                          .filter(Boolean)
                          .join(' · '),
                  },
              ]
            : []),
        {
            label: t('carrier.channel.days'),
            value: t('carrier.channel.daysValue', { min: channel.estimatedDays.min, max: channel.estimatedDays.max }),
        },
        {
            label: t('carrier.channel.cargo'),
            value: channel.cargoTypes.map((type) => t(`carrier.cargo.${type}`)).join(', '),
        },
        { label: t('carrier.channel.original'), value: channel.originalName },
    ];

    return (
        <div className="grid gap-4 text-sm">
            <p className="m-0 leading-relaxed text-ink dark:text-night-text">{channel.summary}</p>

            <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {facts.map((fact) => (
                    <div key={fact.label}>
                        <dt className="text-xs text-muted dark:text-night-muted">{fact.label}</dt>
                        <dd className="m-0 text-ink dark:text-night-text">{fact.value}</dd>
                    </div>
                ))}
            </dl>
            {channel.estimatedDays.note && (
                <p className="m-0 text-xs text-muted dark:text-night-muted">{channel.estimatedDays.note}</p>
            )}

            <div>
                <h4 className="m-0 mb-1 text-xs font-semibold text-muted uppercase dark:text-night-muted">
                    {t('carrier.channel.accepts')}
                </h4>
                <p className="m-0 leading-relaxed text-ink dark:text-night-text">{channel.acceptedGoods}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <ChannelList items={channel.advantages} title={t('carrier.channel.advantages')} />
                <ChannelList items={channel.disadvantages} title={t('carrier.channel.disadvantages')} />
            </div>
            <ChannelList items={channel.requirements} title={t('carrier.channel.requirements')} />

            {channel.taxDisclaimer && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-night-warning/25 dark:bg-night-warning-surface dark:text-night-warning">
                    <strong className="mb-0.5 block">{t('carrier.channel.tax')}</strong>
                    {channel.taxDisclaimer}
                </div>
            )}
        </div>
    );
}

function ChannelList({ title, items }: { title: string; items: string[] }) {
    if (items.length === 0) return null;
    return (
        <div>
            <h4 className="m-0 mb-1 text-xs font-semibold text-muted uppercase dark:text-night-muted">{title}</h4>
            <ul className="m-0 grid list-disc gap-1 pl-4 leading-relaxed text-ink dark:text-night-text">
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    );
}

/** Selo da linha: preferida e família (Correios ou e-邮宝). */
export function CarrierChannelBadges({ channel }: { channel: Pick<CarrierChannel, 'preferred' | 'family'> }) {
    const { t } = useTranslation();
    return (
        <span className="inline-flex flex-wrap gap-1.5">
            {channel.preferred && <StatusPill tone="success">{t('carrier.channel.preferred')}</StatusPill>}
            <StatusPill tone="neutral" hideDot>
                {channel.family === 'EUB' ? t('carrier.channel.eub') : t('carrier.channel.correios')}
            </StatusPill>
        </span>
    );
}
