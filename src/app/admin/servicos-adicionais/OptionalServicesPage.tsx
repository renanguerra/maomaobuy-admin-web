'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Sparkles } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { money, type OptionalService } from '@/types/api';
import { OptionalServiceFormDialog, type OptionalServiceFormValues } from './OptionalServiceFormDialog';

type Editing = { service?: OptionalService } | null;

/**
 * Catálogo dos adicionais. A lista inclui os desativados de propósito: quem
 * administra precisa ver o que existe para reativar, não só o que está no ar.
 */
export function OptionalServicesPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [services, setServices] = useState<OptionalService[]>();
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState<Editing>(null);

    const load = useCallback(() => {
        api<OptionalService[]>('/optional-services')
            .then((list) => {
                setServices(list);
                setError(undefined);
            })
            .catch((err) =>
                setError(
                    err instanceof ApiError && err.status === 403
                        ? t('optionalServices.forbidden')
                        : t('optionalServices.error'),
                ),
            );
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    async function submit(values: OptionalServiceFormValues) {
        const existing = editing?.service;
        // Na edição o código não vai no corpo: o backend recusa alterá-lo.
        const { code, ...editable } = values;
        await api(existing ? `/optional-services/${existing.id}` : '/optional-services', {
            method: existing ? 'PATCH' : 'POST',
            body: JSON.stringify(existing ? editable : { code, ...editable }),
        });
        notify({
            tone: 'success',
            title: t(existing ? 'optionalServices.updatedFeedback' : 'optionalServices.createdFeedback'),
        });
        setEditing(null);
        load();
    }

    const columns: DataTableColumn<OptionalService>[] = [
        {
            key: 'service',
            header: t('optionalServices.columns.service'),
            cell: (service) => (
                <span className="block min-w-0">
                    <span className="block text-sm font-semibold text-ink dark:text-night-text">{service.name}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted dark:text-night-muted">
                        {service.code}
                    </span>
                </span>
            ),
        },
        {
            key: 'kind',
            header: t('optionalServices.columns.kind'),
            hideBelow: 'md',
            cell: (service) => (
                <StatusPill tone={service.kind === 'BUNDLE' ? 'info' : 'neutral'}>
                    {t(`optionalServices.kinds.${service.kind}`)}
                </StatusPill>
            ),
        },
        {
            key: 'pricingUnit',
            header: t('optionalServices.columns.pricingUnit'),
            hideBelow: 'lg',
            cell: (service) => (
                <span className="text-xs text-muted dark:text-night-muted">
                    {t(`optionalServices.pricingUnits.${service.pricingUnit}`)}
                </span>
            ),
        },
        {
            key: 'price',
            header: t('optionalServices.columns.price'),
            numeric: true,
            cell: (service) => (
                <span className="mm-data font-semibold">
                    {service.maxPriceCnyMinor
                        ? t('optionalServices.priceRange', {
                              min: money(service.priceCnyMinor, 'CNY'),
                              max: money(service.maxPriceCnyMinor, 'CNY'),
                          })
                        : money(service.priceCnyMinor, 'CNY')}
                </span>
            ),
        },
        {
            key: 'status',
            header: t('optionalServices.columns.status'),
            hideBelow: 'md',
            cell: (service) => (
                <StatusPill tone={service.isActive ? 'success' : 'neutral'}>
                    {t(service.isActive ? 'optionalServices.statuses.active' : 'optionalServices.statuses.inactive')}
                </StatusPill>
            ),
        },
        {
            key: 'actions',
            header: '',
            card: 'full',
            cell: (service) => (
                <Button
                    aria-label={t('optionalServices.edit')}
                    iconOnly
                    onClick={() => setEditing({ service })}
                    size="small"
                    variant="ghost"
                >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={<Button onClick={() => setEditing({})}>{t('optionalServices.newService')}</Button>}
                description={t('optionalServices.description')}
                kicker={t('optionalServices.kicker')}
                title={t('optionalServices.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            {!error && (
                <SectionCard flush>
                    <DataTable
                        caption={t('optionalServices.title')}
                        columns={columns}
                        loading={!services}
                        loadingLabel={t('common.loading')}
                        minWidth="46rem"
                        rowKey={(service) => service.id}
                        rows={services ?? []}
                        empty={<EmptyState icon={Sparkles} title={t('optionalServices.empty')} />}
                    />
                </SectionCard>
            )}

            <OptionalServiceFormDialog
                onClose={() => setEditing(null)}
                onSubmit={submit}
                open={editing !== null}
                service={editing?.service}
            />
        </div>
    );
}
