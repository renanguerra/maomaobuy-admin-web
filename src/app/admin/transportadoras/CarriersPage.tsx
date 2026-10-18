'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Truck } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { CarrierChannelBadges, CarrierChannelDetails } from '@/components/admin/CarrierShipments';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { kilograms, type CarrierChannel, type CarrierChannels } from '@/types/carrier';

/**
 * As linhas da Westlink para o Brasil, com tudo o que a tabela de preços diz
 * de cada uma. "Conferir conta" pergunta à API quais estão liberadas — é
 * também o teste mais rápido de que as credenciais funcionam.
 */
export function CarriersPage() {
    const { t } = useTranslation();
    const [data, setData] = useState<CarrierChannels>();
    const [error, setError] = useState<string>();
    const [checking, setChecking] = useState(false);

    const load = useCallback(
        (check: boolean) => {
            api<CarrierChannels>(`/carrier-shipments/channels${check ? '?check=true' : ''}`)
                .then((loaded) => {
                    setData(loaded);
                    setError(undefined);
                })
                .catch((err) => setError(err instanceof ApiError ? err.message : t('common.errors.generic')))
                .finally(() => setChecking(false));
        },
        [t],
    );

    useEffect(() => {
        load(false);
    }, [load]);

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('carrier.page.description')}
                kicker={t('carrier.page.kicker')}
                title={t('carrier.page.title')}
                actions={
                    <Button
                        disabled={!data?.configured}
                        leadingIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                        loading={checking}
                        onClick={() => {
                            setChecking(true);
                            load(true);
                        }}
                        size="small"
                        variant="secondary"
                    >
                        {t('carrier.page.checkAccount')}
                    </Button>
                }
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}
            {data && !data.configured && (
                <Alert tone="warning" title={t('carrier.page.notConfiguredTitle')}>
                    <p>{t('carrier.page.notConfigured')}</p>
                </Alert>
            )}
            {data?.accountError && (
                <Alert tone="danger" title={t('carrier.page.accountError')}>
                    <p>{data.accountError}</p>
                </Alert>
            )}
            {!data && !error && <SkeletonCards label={t('carrier.page.title')} />}

            {data && <ChannelComparison channels={data.channels} />}

            {data && (
                <div className="grid gap-5 xl:grid-cols-2">
                    {data.channels.map((channel) => (
                        <ChannelCard channel={channel} key={channel.code} />
                    ))}
                </div>
            )}

            {data && data.otherAccountChannels.length > 0 && (
                <SectionCard description={t('carrier.page.otherChannelsHint')} title={t('carrier.page.otherChannels')}>
                    <ul className="m-0 grid list-none gap-1 p-0 text-sm sm:grid-cols-2">
                        {data.otherAccountChannels.map((channel) => (
                            <li key={channel.code}>
                                <span className="mm-data font-semibold text-ink dark:text-night-text">
                                    {channel.code}
                                </span>{' '}
                                <span className="text-muted dark:text-night-muted">{channel.name}</span>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}
        </div>
    );
}

/**
 * As dez linhas lado a lado, para escolher sem ler dez cartões. Cada código
 * leva ao cartão completo.
 */
function ChannelComparison({ channels }: { channels: CarrierChannel[] }) {
    const { t } = useTranslation();
    const headers = [
        t('carrier.page.compare.line'),
        t('carrier.page.compare.weight'),
        t('carrier.channel.volumetric'),
        t('carrier.channel.cargo'),
        t('carrier.channel.days'),
        t('carrier.page.compare.account'),
    ];
    return (
        <SectionCard flush title={t('carrier.page.compare.title')}>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-line text-left text-xs text-muted dark:border-night-line dark:text-night-muted">
                            {headers.map((header) => (
                                <th className="px-4 py-2 font-semibold" key={header} scope="col">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {channels.map((channel) => (
                            <tr
                                className="border-b border-line last:border-0 dark:border-night-line"
                                key={channel.code}
                            >
                                <th className="px-4 py-2 text-left font-normal" scope="row">
                                    <a
                                        className="mm-data font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                                        href={`#linha-${channel.code}`}
                                    >
                                        {channel.code}
                                    </a>{' '}
                                    <span className="text-ink dark:text-night-text">{channel.name}</span>
                                    {channel.preferred && (
                                        <span className="ml-1.5 align-middle">
                                            <StatusPill tone="success">{t('carrier.channel.preferred')}</StatusPill>
                                        </span>
                                    )}
                                </th>
                                <td className="mm-data px-4 py-2 whitespace-nowrap">
                                    {kilograms(channel.maxWeightGrams)}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                    {channel.volumetricDivisor
                                        ? `÷${channel.volumetricDivisor}`
                                        : t('carrier.channel.noVolumetric')}
                                </td>
                                <td className="px-4 py-2">
                                    {channel.cargoTypes.map((type) => t(`carrier.cargo.${type}`)).join(', ')}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                    {t('carrier.channel.daysValue', {
                                        min: channel.estimatedDays.min,
                                        max: channel.estimatedDays.max,
                                    })}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                    {channel.enabledForAccount === null
                                        ? t('common.dash')
                                        : channel.enabledForAccount
                                          ? t('carrier.page.enabled')
                                          : t('carrier.page.notEnabled')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionCard>
    );
}

function ChannelCard({ channel }: { channel: CarrierChannel }) {
    const { t } = useTranslation();
    return (
        <div className="scroll-mt-6" id={`linha-${channel.code}`}>
            <SectionCard
                icon={<Truck aria-hidden="true" />}
                title={
                    <span className="inline-flex flex-wrap items-center gap-2">
                        <span className="mm-data">{channel.code}</span>
                        <span>{channel.name}</span>
                    </span>
                }
                action={
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                        <CarrierChannelBadges channel={channel} />
                        {channel.enabledForAccount !== null && (
                            <StatusPill tone={channel.enabledForAccount ? 'success' : 'danger'}>
                                {channel.enabledForAccount ? t('carrier.page.enabled') : t('carrier.page.notEnabled')}
                            </StatusPill>
                        )}
                    </span>
                }
            >
                <CarrierChannelDetails channel={channel} />
            </SectionCard>
        </div>
    );
}
