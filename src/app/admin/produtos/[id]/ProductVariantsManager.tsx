'use client';

import { useState } from 'react';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminProductVariant } from '@/types/api';
import { VariantFormDialog, type VariantFormValues } from '../VariantFormDialog';
import { minorToAmount } from './ProductDetailPage.utils';

interface ProductVariantsManagerProps {
    productId: string;
    variants: AdminProductVariant[];
    onChanged: () => void;
}

export function ProductVariantsManager({ productId, variants, onChanged }: ProductVariantsManagerProps) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const confirm = useConfirm();
    const [editing, setEditing] = useState<AdminProductVariant | 'new'>();
    const [busyId, setBusyId] = useState<string>();

    async function submitVariant(values: VariantFormValues) {
        const isNew = editing === 'new';
        await api(
            isNew
                ? `/products/${productId}/variants`
                : `/products/${productId}/variants/${(editing as AdminProductVariant).id}`,
            {
                method: isNew ? 'POST' : 'PATCH',
                body: JSON.stringify(values),
            },
        );
        setEditing(undefined);
        notify({
            tone: 'success',
            title: isNew ? t('products.detail.variants.addedToast') : t('products.detail.variants.updatedToast'),
        });
        onChanged();
    }

    async function deleteVariant(variant: AdminProductVariant) {
        const confirmed = await confirm({
            title: t('products.detail.variants.deleteTitle', { name: variant.label }),
            description: t('products.detail.variants.deleteConfirm'),
            confirmLabel: t('common.actions.delete'),
            tone: 'danger',
        });
        if (!confirmed) return;

        setBusyId(variant.id);
        try {
            await api(`/products/${productId}/variants/${variant.id}`, { method: 'DELETE' });
            notify({ tone: 'success', title: t('products.detail.variants.deletedToast') });
            onChanged();
        } catch (err) {
            notify({
                tone: 'danger',
                title: t('common.errors.actionTitle'),
                description: err instanceof ApiError ? err.message : t('common.errors.generic'),
            });
        } finally {
            setBusyId(undefined);
        }
    }

    return (
        <>
            <SectionCard
                description={t('products.detail.variants.description')}
                flush
                title={t('products.detail.variants.title')}
                action={
                    <Button
                        leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => setEditing('new')}
                        size="small"
                        variant="secondary"
                    >
                        {t('products.detail.variants.addButton')}
                    </Button>
                }
            >
                {variants.length === 0 ? (
                    <EmptyState icon={Layers} title={t('products.detail.variants.empty')} />
                ) : (
                    <ListRows>
                        {variants.map((variant) => (
                            <li key={variant.id}>
                                <ListRow
                                    meta={`${variant.externalId} · ${minorToAmount(variant.amountAdjustmentMinor)}`}
                                    title={variant.label}
                                    pill={
                                        <StatusPill tone={variant.isAvailable ? 'success' : 'neutral'}>
                                            {variant.isAvailable
                                                ? t('products.detail.variants.available_state')
                                                : t('products.detail.variants.unavailable_state')}
                                        </StatusPill>
                                    }
                                    actions={
                                        <>
                                            <Button
                                                aria-label={t('products.detail.variants.editAria', {
                                                    name: variant.label,
                                                })}
                                                iconOnly
                                                onClick={() => setEditing(variant)}
                                                size="small"
                                                variant="ghost"
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                            <Button
                                                aria-label={t('products.detail.variants.deleteAria', {
                                                    name: variant.label,
                                                })}
                                                iconOnly
                                                loading={busyId === variant.id}
                                                onClick={() => deleteVariant(variant)}
                                                size="small"
                                                variant="dangerGhost"
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </>
                                    }
                                />
                            </li>
                        ))}
                    </ListRows>
                )}
            </SectionCard>

            <VariantFormDialog
                onClose={() => setEditing(undefined)}
                onSubmit={submitVariant}
                open={editing !== undefined}
                initialValues={
                    editing && editing !== 'new'
                        ? {
                              externalId: editing.externalId,
                              label: editing.label,
                              amountAdjustmentMinor: editing.amountAdjustmentMinor,
                              isAvailable: editing.isAvailable,
                          }
                        : undefined
                }
            />
        </>
    );
}
