'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleDollarSign, CalendarClock, PackageOpen, ShoppingBag } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { StatCard } from '@/components/admin/StatCard';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { cny, formatDate } from '@/types/api';
import type { CustomerSummary } from '@/types/customers';
import { CustomerNotes } from './CustomerNotes';
import { CustomerTags } from './CustomerTags';
import { CustomerTimeline } from './CustomerTimeline';

/** Aba Resumo: números, etiquetas, notas e o que aconteceu. */
export function CustomerOverview({ userId }: { userId: string }) {
    const { t } = useTranslation();
    const [summary, setSummary] = useState<CustomerSummary>();
    const [failed, setFailed] = useState(false);
    // Nota nova entra na linha do tempo: muda a chave e ela recarrega.
    const [version, setVersion] = useState(0);

    const load = useCallback(() => {
        api<CustomerSummary>(`/customers/${userId}/summary`)
            .then((loaded) => {
                setSummary(loaded);
                setFailed(false);
            })
            .catch(() => setFailed(true));
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    if (failed)
        return (
            <Alert
                tone="danger"
                title={t('common.errors.loadTitle')}
                action={
                    <Button onClick={load} size="small" variant="secondary">
                        {t('common.actions.retry')}
                    </Button>
                }
            >
                <p>{t('users.detail.error')}</p>
            </Alert>
        );
    if (!summary) return <SkeletonCards label={t('users.detail.loading')} />;

    const waiting = [
        ...(summary.unpackedUnits > 0 ? [t('customers.waiting.unpacked', { count: summary.unpackedUnits })] : []),
        ...(summary.freightUnpaid > 0 ? [t('customers.waiting.freight', { count: summary.freightUnpaid })] : []),
    ];

    return (
        <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                    icon={ShoppingBag}
                    label={t('customers.stats.purchases')}
                    value={summary.purchases}
                    hint={
                        summary.firstPurchaseAt
                            ? t('customers.stats.since', { date: formatDate(summary.firstPurchaseAt) })
                            : undefined
                    }
                />
                <StatCard
                    icon={CircleDollarSign}
                    label={t('customers.stats.spent')}
                    value={<span className="text-xl break-words sm:text-3xl">{cny(summary.spentAmountMinor)}</span>}
                    hint={t('customers.stats.spentHint')}
                />
                <StatCard
                    icon={CalendarClock}
                    label={t('customers.stats.lastPurchase')}
                    value={
                        <span className="grid text-base leading-snug sm:text-xl">
                            {summary.lastPurchaseAt ? formatDate(summary.lastPurchaseAt) : t('common.dash')}
                        </span>
                    }
                />
                <StatCard
                    icon={PackageOpen}
                    label={t('customers.waiting.title')}
                    tone={waiting.length > 0 ? 'warning' : 'neutral'}
                    value={
                        <span className="grid text-base leading-snug">
                            {waiting.length > 0
                                ? waiting.map((text) => <span key={text}>{text}</span>)
                                : t('customers.waiting.none')}
                        </span>
                    }
                />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
                <CustomerTimeline key={version} userId={userId} />
                <div className="grid gap-5 max-xl:order-first">
                    <CustomerTags initialTags={summary.tags} userId={userId} />
                    <CustomerNotes onChanged={() => setVersion((value) => value + 1)} userId={userId} />
                </div>
            </div>
        </>
    );
}
