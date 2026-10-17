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
import type { CarrierChannel, CarrierChannels } from '@/types/carrier';

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

function ChannelCard({ channel }: { channel: CarrierChannel }) {
    const { t } = useTranslation();
    return (
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
    );
}
