'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PackageOpen, PackagePlus } from 'lucide-react';
import { ageTone, useFormatAge } from '@/components/admin/AgeBadge';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { ButtonLink } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { formatDate, type AdminUnpackedCustomer } from '@/types/api';

/**
 * O que está no armazém, liberado para envio, e que nenhum pacote pegou.
 * Quem monta o pacote é o cliente: esta tela existe para o time ver quem
 * lembrar antes da armazenagem grátis acabar — e, quando fizer sentido,
 * montar o pacote por ele.
 */
export function UnpackedItemsPage() {
    const { t } = useTranslation();
    const formatAge = useFormatAge();
    const [customers, setCustomers] = useState<AdminUnpackedCustomer[]>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        let active = true;
        api<AdminUnpackedCustomer[]>('/packages/unpacked')
            .then((loaded) => {
                if (active) setCustomers(loaded);
            })
            .catch(() => {
                if (active) setError(t('unpacked.error'));
            });
        return () => {
            active = false;
        };
    }, [t]);

    const units = (customers ?? []).reduce(
        (sum, customer) => sum + customer.items.reduce((total, item) => total + item.quantity, 0),
        0,
    );

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('unpacked.description')}
                kicker={t('unpacked.kicker')}
                title={t('unpacked.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            {!customers && !error && <SkeletonCards label={t('unpacked.loading')} />}

            {customers && customers.length === 0 && (
                <EmptyState
                    description={t('unpacked.emptyDescription')}
                    icon={PackageOpen}
                    title={t('unpacked.empty')}
                />
            )}

            {customers && customers.length > 0 && (
                <>
                    <p className="m-0 text-sm text-muted dark:text-night-muted">
                        {t('unpacked.summary', { customers: customers.length, units })}
                    </p>
                    <div className="grid gap-4">
                        {customers.map((customer) => {
                            const tone =
                                customer.oldestArrivedAt && customer.freeStorageUntil
                                    ? ageTone(customer.oldestArrivedAt, customer.freeStorageUntil)
                                    : 'ok';
                            const charging = tone === 'overdue';
                            return (
                                <SectionCard
                                    flush
                                    key={customer.userId}
                                    title={customer.userName || customer.userEmail}
                                    description={customer.userEmail}
                                    action={
                                        <div className="flex flex-wrap gap-2">
                                            <ButtonLink
                                                href={`/admin/usuarios/${customer.userId}`}
                                                size="small"
                                                variant="secondary"
                                            >
                                                {t('unpacked.openCustomer')}
                                            </ButtonLink>
                                            <ButtonLink
                                                href={`/admin/usuarios/${customer.userId}?acao=pacote`}
                                                leadingIcon={<PackagePlus className="h-4 w-4" aria-hidden="true" />}
                                                size="small"
                                            >
                                                {t('unpacked.createPackage')}
                                            </ButtonLink>
                                        </div>
                                    }
                                >
                                    {customer.oldestArrivedAt && (
                                        <p
                                            className={`m-0 flex flex-wrap gap-x-3 gap-y-1 border-b border-line px-5 py-2.5 text-xs font-semibold dark:border-night-line ${
                                                tone === 'overdue'
                                                    ? 'bg-origin-50 text-origin-700 dark:bg-night-coral-surface dark:text-night-coral'
                                                    : tone === 'near'
                                                      ? 'bg-amber-50 text-amber-800 dark:bg-night-warning-surface dark:text-night-warning'
                                                      : 'text-muted dark:text-night-muted'
                                            }`}
                                        >
                                            <span>
                                                {t('unpacked.inWarehouseFor', {
                                                    age: formatAge(customer.oldestArrivedAt),
                                                })}
                                            </span>
                                            {customer.freeStorageUntil && (
                                                <span>
                                                    {charging
                                                        ? t('unpacked.charging', {
                                                              date: formatDate(customer.freeStorageUntil),
                                                          })
                                                        : t('unpacked.freeUntil', {
                                                              date: formatDate(customer.freeStorageUntil),
                                                          })}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    <ul className="m-0 grid list-none gap-0 p-0">
                                        {customer.items.map((item) => (
                                            <li
                                                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-2.5 text-sm last:border-b-0 dark:border-night-line"
                                                key={item.orderItemId}
                                            >
                                                <span className="min-w-0 flex-1 truncate font-semibold text-ink dark:text-night-text">
                                                    {item.productName}
                                                </span>
                                                <span className="mm-data text-xs text-muted dark:text-night-muted">
                                                    {t('unpacked.units', { count: item.quantity })}
                                                </span>
                                                <span className="text-xs text-muted dark:text-night-muted">
                                                    {t('unpacked.arrived', { date: formatDate(item.arrivedAt) })}
                                                </span>
                                                <Link
                                                    className="mm-data text-xs text-primary no-underline hover:underline dark:text-night-accent"
                                                    href={`/admin/pedidos/${item.orderId}`}
                                                >
                                                    {t('unpacked.order', { code: item.orderId.slice(0, 8) })}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </SectionCard>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
