'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import { kilograms } from '@/types/carrier';
import type { ShippingBox } from '@/types/shipping-box';
import { canWriteShippingTable, yuan } from '@/types/shipping-table';
import { ShippingBoxDialog } from './ShippingBoxDialog';

const centimeters = (mm: number) => (mm / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/**
 * Peso volumétrico da embalagem em gramas (C × L × A em cm ÷ divisor, em kg):
 * o mínimo que ela "cobra" mesmo vazia nas linhas que usam volumétrico.
 */
const volumetric = (box: ShippingBox, divisor: number) =>
    Math.ceil((box.lengthMm * box.widthMm * box.heightMm) / divisor);

/**
 * Embalagens do armazém (caixas, envelopes). As ativas montam os volumes da
 * estimativa de frete do carrinho: cada volume vai na menor que leva tudo. O
 * custo é só controle interno.
 */
export function ShippingBoxesPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const { admin } = useAdminAccountAuth();
    const canWrite = canWriteShippingTable(admin?.role);
    const [boxes, setBoxes] = useState<ShippingBox[]>();
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState<{ box: ShippingBox | null }>();

    const load = useCallback(() => {
        api<ShippingBox[]>('/shipping-boxes')
            .then((loaded) => {
                setBoxes(loaded);
                setError(undefined);
            })
            .catch((err) => setError(err instanceof ApiError ? err.message : t('common.errors.generic')));
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    const headers = [
        t('shippingBoxes.list.box'),
        t('shippingBoxes.list.inner'),
        t('shippingBoxes.list.weights'),
        t('shippingBoxes.list.volumetric'),
        t('shippingBoxes.list.cost'),
        '',
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('shippingBoxes.page.description')}
                kicker={t('shippingBoxes.page.kicker')}
                title={t('shippingBoxes.page.title')}
                actions={
                    canWrite && boxes ? (
                        <Button
                            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setEditing({ box: null })}
                            size="small"
                        >
                            {t('shippingBoxes.page.new')}
                        </Button>
                    ) : undefined
                }
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}
            {!boxes && !error && <SkeletonCards label={t('shippingBoxes.page.title')} />}
            {boxes && boxes.every((box) => !box.isActive) && (
                <Alert tone="warning" title={t('shippingBoxes.page.noneActiveTitle')}>
                    <p>{t('shippingBoxes.page.noneActive')}</p>
                </Alert>
            )}

            {boxes && (
                <SectionCard flush icon={<Package aria-hidden="true" />} title={t('shippingBoxes.list.title')}>
                    {boxes.length === 0 ? (
                        <div className="p-4">
                            <EmptyState title={t('shippingBoxes.list.empty')} />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[44rem] border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line text-left text-xs text-muted dark:border-night-line dark:text-night-muted">
                                        {headers.map((header, index) => (
                                            <th className="px-4 py-2 font-semibold" key={index} scope="col">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {boxes.map((box) => (
                                        <tr
                                            className="border-b border-line align-top last:border-0 dark:border-night-line"
                                            key={box.id}
                                        >
                                            <th className="min-w-[14rem] px-4 py-3 text-left font-normal" scope="row">
                                                <span className="font-semibold text-ink dark:text-night-text">
                                                    {box.label}
                                                </span>
                                                {!box.isActive && (
                                                    <span className="ml-1.5 align-middle">
                                                        <StatusPill tone="neutral">
                                                            {t('shippingBoxes.list.inactive')}
                                                        </StatusPill>
                                                    </span>
                                                )}
                                                {box.notes && (
                                                    <span className="mt-0.5 block text-xs text-muted dark:text-night-muted">
                                                        {box.notes}
                                                    </span>
                                                )}
                                            </th>
                                            <td className="mm-data px-4 py-3 whitespace-nowrap">
                                                {centimeters(box.lengthMm)} × {centimeters(box.widthMm)} ×{' '}
                                                {centimeters(box.heightMm)} cm
                                            </td>
                                            <td className="mm-data px-4 py-3 whitespace-nowrap">
                                                {t('shippingBoxes.list.weightsValue', {
                                                    empty: kilograms(box.emptyWeightGrams),
                                                    max: kilograms(box.maxGrossWeightGrams),
                                                })}
                                            </td>
                                            <td className="mm-data px-4 py-3 whitespace-nowrap text-muted dark:text-night-muted">
                                                {kilograms(volumetric(box, 8000))} (÷8000)
                                                <br />
                                                {kilograms(volumetric(box, 6000))} (÷6000)
                                            </td>
                                            <td className="mm-data px-4 py-3 whitespace-nowrap">
                                                {box.costAmountMinor === null
                                                    ? t('common.dash')
                                                    : yuan(box.costAmountMinor)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {canWrite && (
                                                    <Button
                                                        onClick={() => setEditing({ box })}
                                                        size="small"
                                                        variant="ghost"
                                                    >
                                                        {t('shippingTable.page.edit')}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            {editing && (
                <ShippingBoxDialog
                    box={editing.box}
                    onClose={() => setEditing(undefined)}
                    onSaved={() => {
                        setEditing(undefined);
                        notify({ tone: 'success', title: t('shippingTable.page.saved') });
                        load();
                    }}
                />
            )}
        </div>
    );
}
