'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminCategory, AdminProduct } from '@/types/api';
import { ProductFormFields } from '../ProductFormFields';
import { ProductMediaManager } from '../ProductMediaManager';
import { VariantFormDialog, type VariantFormValues } from '../VariantFormDialog';
import { toProductPayload, useProductForm } from '../product-form';
import { minorToAmount } from '../[id]/ProductDetailPage.utils';
import type { VariantDraft } from './NewProductPage.types';

const STEPS = [
    { key: 'info' as const, labelKey: 'products.new.steps.info' as const },
    { key: 'media' as const, labelKey: 'products.new.steps.media' as const },
];

/**
 * Criação em duas etapas: primeiro o produto vira rascunho no backend, depois
 * a mídia é enviada contra o ID recém-criado. Não dá para inverter — o upload
 * pré-assinado exige um produto existente.
 */
export function NewProductPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const router = useRouter();
    const form = useProductForm();
    const [step, setStep] = useState<'info' | 'media'>('info');
    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [variants, setVariants] = useState<VariantDraft[]>([]);
    const [editingVariant, setEditingVariant] = useState<VariantDraft | 'new'>();
    const [product, setProduct] = useState<AdminProduct>();
    const [submitting, setSubmitting] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        api<AdminCategory[]>('/categories')
            .then(setCategories)
            .catch(() => {
                /* seleção de categorias é opcional; falha silenciosa aqui */
            });
    }, []);

    function reloadProduct() {
        if (!product) return;
        api<AdminProduct>(`/products/${product.id}`)
            .then(setProduct)
            .catch(() => setError(t('products.new.mediaReloadError')));
    }

    function submitVariant(values: VariantFormValues) {
        setVariants((current) =>
            editingVariant && editingVariant !== 'new'
                ? current.map((variant) => (variant.key === editingVariant.key ? { ...variant, ...values } : variant))
                : [...current, { key: crypto.randomUUID(), ...values }],
        );
        setEditingVariant(undefined);
    }

    async function handleCreateDraft(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (form.values.sourceAmountMinor === '0') {
            setError(t('products.new.priceRequiredError'));
            return;
        }

        setSubmitting(true);
        setError(undefined);
        try {
            const payload = toProductPayload(form.values);
            const created = await api<AdminProduct>('/products', {
                method: 'POST',
                body: JSON.stringify({
                    ...payload,
                    // O produto nasce como rascunho: publicar antes da mídia deixaria
                    // a loja com um item sem foto.
                    isPublished: false,
                    estimatedShippingAmountMinor:
                        payload.estimatedShippingAmountMinor !== '0' ? payload.estimatedShippingAmountMinor : undefined,
                    variants:
                        variants.length > 0
                            ? variants.map((variant) => ({
                                  externalId: variant.externalId,
                                  label: variant.label,
                                  amountAdjustmentMinor: variant.amountAdjustmentMinor,
                                  isAvailable: variant.isAvailable,
                              }))
                            : undefined,
                    categoryIds: payload.categoryIds.length > 0 ? payload.categoryIds : undefined,
                    subcategoryIds: payload.subcategoryIds.length > 0 ? payload.subcategoryIds : undefined,
                }),
            });
            setProduct(created);
            setStep('media');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('products.new.createError'));
        } finally {
            setSubmitting(false);
        }
    }

    async function handleFinish() {
        if (!product) return;

        setFinishing(true);
        setError(undefined);
        try {
            if (form.values.isPublished) {
                await api(`/products/${product.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ isPublished: true }),
                });
            }
            notify({ tone: 'success', title: t('products.new.finishedToast', { name: product.name }) });
            router.replace(`/admin/produtos/${product.id}`);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('products.new.publishError'));
            setFinishing(false);
        }
    }

    return (
        <div className="grid gap-6">
            <PageHeader
                backHref="/admin/produtos"
                backLabel={t('products.new.backLink')}
                description={step === 'info' ? t('products.new.stepHintInfo') : t('products.new.stepHintMedia')}
                kicker={t('products.new.kicker')}
                title={t('products.new.title')}
            />

            <ol className="m-0 flex list-none flex-wrap items-center gap-3 p-0">
                {STEPS.map((item, index) => {
                    const isCurrent = step === item.key;
                    const isDone = item.key === 'info' && step === 'media';
                    return (
                        <li className="flex items-center gap-3" key={item.key}>
                            <span
                                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                                    isDone
                                        ? 'border-jade-500 bg-jade-500 text-white'
                                        : isCurrent
                                          ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
                                          : 'border-line text-muted dark:border-night-line dark:text-night-muted'
                                }`}
                                aria-hidden="true"
                            >
                                {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                            </span>
                            <span
                                className={`text-sm font-semibold ${
                                    isCurrent ? 'text-ink dark:text-night-text' : 'text-muted dark:text-night-muted'
                                }`}
                                aria-current={isCurrent ? 'step' : undefined}
                            >
                                {t(item.labelKey)}
                            </span>
                            {index < STEPS.length - 1 && (
                                <span className="h-px w-8 bg-line dark:bg-night-line" aria-hidden="true" />
                            )}
                        </li>
                    );
                })}
            </ol>

            {error && (
                <Alert tone="danger" title={t('common.errors.actionTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            {step === 'info' && (
                <form className="grid gap-5" onSubmit={handleCreateDraft}>
                    <ProductFormFields categories={categories} form={form} />

                    <SectionCard
                        description={t('products.new.variants.description')}
                        flush
                        title={t('products.new.variants.title')}
                        action={
                            <Button
                                leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setEditingVariant('new')}
                                size="small"
                                type="button"
                                variant="secondary"
                            >
                                {t('products.new.variants.addButton')}
                            </Button>
                        }
                    >
                        {variants.length === 0 ? (
                            <EmptyState
                                description={t('products.new.variants.emptyDescription')}
                                icon={Layers}
                                title={t('products.new.variants.empty')}
                            />
                        ) : (
                            <ListRows>
                                {variants.map((variant) => (
                                    <li key={variant.key}>
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
                                                        onClick={() => setEditingVariant(variant)}
                                                        size="small"
                                                        type="button"
                                                        variant="ghost"
                                                    >
                                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                    <Button
                                                        aria-label={t('products.detail.variants.deleteAria', {
                                                            name: variant.label,
                                                        })}
                                                        iconOnly
                                                        onClick={() =>
                                                            setVariants((current) =>
                                                                current.filter((item) => item.key !== variant.key),
                                                            )
                                                        }
                                                        size="small"
                                                        type="button"
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

                    <div className="flex justify-end">
                        <Button loading={submitting} type="submit">
                            {submitting ? t('products.new.creatingButton') : t('products.new.continueButton')}
                        </Button>
                    </div>
                </form>
            )}

            {step === 'media' && product && (
                <div className="grid gap-5">
                    <Alert tone="success" title={t('products.new.mediaStep.createdTitle', { name: product.name })}>
                        <p>{t('products.new.mediaStep.createdMessage')}</p>
                    </Alert>

                    <ProductMediaManager media={product.media} onChanged={reloadProduct} productId={product.id} />

                    <div className="flex flex-wrap justify-end gap-2">
                        <Button
                            onClick={() => router.replace(`/admin/produtos/${product.id}`)}
                            type="button"
                            variant="ghost"
                        >
                            {t('products.new.mediaStep.finishLaterButton')}
                        </Button>
                        <Button
                            disabled={product.media.length === 0}
                            loading={finishing}
                            onClick={handleFinish}
                            type="button"
                        >
                            {finishing
                                ? t('products.new.mediaStep.finishingButton')
                                : t('products.new.mediaStep.finishButton')}
                        </Button>
                    </div>
                </div>
            )}

            <VariantFormDialog
                onClose={() => setEditingVariant(undefined)}
                onSubmit={submitVariant}
                open={editingVariant !== undefined}
                initialValues={
                    editingVariant && editingVariant !== 'new'
                        ? {
                              externalId: editingVariant.externalId,
                              label: editingVariant.label,
                              amountAdjustmentMinor: editingVariant.amountAdjustmentMinor,
                              isAvailable: editingVariant.isAvailable,
                          }
                        : undefined
                }
            />
        </div>
    );
}
