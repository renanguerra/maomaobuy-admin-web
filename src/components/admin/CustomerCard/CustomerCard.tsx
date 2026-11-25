'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SectionCard } from '@/components/admin/SectionCard';
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
            <p className="mt-2 mb-0 text-sm font-semibold text-ink dark:text-night-text">
                {summary.purchases === 1
                    ? t('customers.card.onePurchase', { amount: cny(summary.spentAmountMinor) })
                    : t('customers.card.purchases', {
                          count: summary.purchases,
                          amount: cny(summary.spentAmountMinor),
                      })}
            </p>
            {(summary.lastPurchaseAt || summary.notes > 0) && (
                <p className="mt-0.5 mb-0 flex flex-wrap gap-x-3 text-xs text-muted dark:text-night-muted">
                    {summary.lastPurchaseAt && (
                        <span>{t('customers.card.lastPurchase', { date: formatDate(summary.lastPurchaseAt) })}</span>
                    )}
                    {summary.notes > 0 && (
                        <Link
                            className="font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                            href={href}
                        >
                            {t('customers.notes.count', { count: summary.notes })}
                        </Link>
                    )}
                </p>
            )}
        </SectionCard>
    );
}
