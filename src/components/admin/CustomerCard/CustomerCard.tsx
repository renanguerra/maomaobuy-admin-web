'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SectionCard } from '@/components/admin/SectionCard';
import { SummaryList } from '@/components/admin/SummaryList';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { cny, formatDate } from '@/types/api';
import type { CustomerSummary } from '@/types/customers';
import { CustomerTag } from './CustomerTag';

/**
 * Quem é o cliente, sem sair do pedido ou do pacote. É complemento: se a
 * consulta falhar, a tela segue sem o cartão.
 */
export function CustomerCard({ userId, name, href }: { userId: string; name: string; href: string }) {
    const { t } = useTranslation();
    const [summary, setSummary] = useState<CustomerSummary>();

    useEffect(() => {
        let active = true;
        api<CustomerSummary>(`/customers/${userId}/summary`)
            .then((loaded) => {
                if (active) setSummary(loaded);
            })
            .catch(() => {
                if (active) setSummary(undefined);
            });
        return () => {
            active = false;
        };
    }, [userId]);

    if (!summary) return null;

    return (
        <SectionCard dense title={t('customers.card.title')}>
            <Link
                className="font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                href={href}
            >
                {name}
            </Link>
            {summary.tags.length > 0 && (
                <p className="mt-2 mb-0 flex flex-wrap gap-1.5">
                    {summary.tags.map((tag) => (
                        <CustomerTag key={tag} label={tag} />
                    ))}
                </p>
            )}
            <SummaryList
                className="mt-2"
                rows={[
                    { label: t('customers.stats.purchases'), value: summary.purchases },
                    { label: t('customers.stats.spent'), value: cny(summary.spentAmountMinor) },
                    {
                        label: t('customers.stats.lastPurchase'),
                        value: summary.lastPurchaseAt ? formatDate(summary.lastPurchaseAt) : t('common.dash'),
                    },
                    ...(summary.notes > 0
                        ? [
                              {
                                  label: t('customers.notes.title'),
                                  value: (
                                      <Link
                                          className="text-primary no-underline hover:underline dark:text-night-accent"
                                          href={href}
                                      >
                                          {t('customers.notes.count', { count: summary.notes })}
                                      </Link>
                                  ),
                              },
                          ]
                        : []),
                ]}
            />
        </SectionCard>
    );
}
