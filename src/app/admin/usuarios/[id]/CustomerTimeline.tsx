'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { Timeline } from '@/components/admin/Timeline';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { formatDate } from '@/types/api';
import type { CustomerTimelineEvent, CustomerTimelinePage } from '@/types/customers';

function hrefOf(event: CustomerTimelineEvent): string | undefined {
    if (!event.resourceId) return undefined;
    if (event.kind.startsWith('ORDER_')) return `/admin/pedidos/${event.resourceId}`;
    if (event.kind.startsWith('PACKAGE_')) return `/admin/pacotes/${event.resourceId}`;
    if (event.kind === 'PRODUCT_REQUEST') return `/admin/pedidos-de-produto/${event.resourceId}`;
    return undefined;
}

/** Compras, pacotes, mensagens, e-mails e notas na ordem em que aconteceram. */
export function CustomerTimeline({ userId }: { userId: string }) {
    const { t } = useTranslation();
    const [events, setEvents] = useState<CustomerTimelineEvent[]>();
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const fetchPage = useCallback(
        (from: string | null) =>
            api<CustomerTimelinePage>(
                `/customers/${userId}/timeline${from ? `?${new URLSearchParams({ cursor: from }).toString()}` : ''}`,
            )
                .then((page) => {
                    setEvents((current) => (from ? [...(current ?? []), ...page.data] : page.data));
                    setCursor(page.nextCursor);
                    setFailed(false);
                })
                .catch(() => setFailed(true))
                .finally(() => setLoading(false)),
        [userId],
    );

    useEffect(() => {
        void fetchPage(null);
    }, [fetchPage]);

    function loadMore() {
        setLoading(true);
        void fetchPage(cursor);
    }

    function titleOf(event: CustomerTimelineEvent): ReactNode {
        const label =
            event.author === 'CUSTOMER' && (event.kind === 'ORDER_MESSAGE' || event.kind === 'PACKAGE_MESSAGE')
                ? t('customers.timeline.customerMessage')
                : t(`customers.timeline.kinds.${event.kind}`);
        const href = hrefOf(event);
        return href ? (
            <Link className="text-inherit no-underline hover:underline" href={href}>
                {label}
                {event.kind.startsWith('ORDER_') && ` #${event.resourceId?.slice(0, 8)}`}
            </Link>
        ) : (
            label
        );
    }

    return (
        <SectionCard title={t('customers.timeline.title')}>
            {!events && loading && <SkeletonCards label={t('customers.timeline.loading')} />}
            {events && (
                <Timeline
                    entries={events.map((event) => ({
                        id: event.key,
                        title: titleOf(event),
                        meta: formatDate(event.at),
                        body: event.detail ?? undefined,
                    }))}
                />
            )}
            {failed && (
                <p className="mt-4 mb-0 text-sm text-origin-700 dark:text-night-coral" role="alert">
                    {t('customers.timeline.error')}
                </p>
            )}
            {(cursor || failed) && (
                <Button className="mt-4" loading={loading} onClick={loadMore} size="small" variant="secondary">
                    {failed ? t('common.actions.retry') : t('customers.timeline.more')}
                </Button>
            )}
        </SectionCard>
    );
}
