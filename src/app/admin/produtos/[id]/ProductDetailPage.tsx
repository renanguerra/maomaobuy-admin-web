'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DescriptionList } from '@/components/admin/DescriptionList';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { publishedTone, StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { productSourceLabel, type AdminCategory, type AdminProduct } from '@/types/api';
import { ProductFormFields } from '../ProductFormFields';
import { ProductMediaManager } from '../ProductMediaManager';
import { toProductPayload, useProductForm } from '../product-form';
import { ProductVariantsManager } from './ProductVariantsManager';
import { minorToAmount } from './ProductDetailPage.utils';

export function ProductDetailPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const confirm = useConfirm();
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [product, setProduct] = useState<AdminProduct>();
    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState<string>();
    const form = useProductForm(product);

    const load = useCallback(() => {
        api<AdminProduct>(`/products/${params.id}`)
            .then((loaded) => {
                setProduct(loaded);
                setError(undefined);
            })
            .catch(() => setError(t('products.detail.error')));
    }, [params.id, t]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        api<AdminCategory[]>('/categories')
            .then(setCategories)
            .catch(() => {
                /* seleção de categorias é opcional; falha silenciosa aqui */
            });
    }, []);

    function reportError(err: unknown) {
        notify({
            tone: 'danger',
            title: t('common.errors.actionTitle'),
            description: err instanceof ApiError ? err.message : t('common.errors.generic'),
        });
    }

    function startEditing(loaded: AdminProduct) {
        form.reset(loaded);
        setEditing(true);
    }

    async function saveInfo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (form.values.sourceAmountMinor === '0') {
            notify({ tone: 'warning', title: t('products.detail.priceRequiredError') });
            return;
        }

        setBusy('save-info');
        try {
            const updated = await api<AdminProduct>(`/products/${params.id}`, {
                method: 'PATCH',
                body: JSON.stringify(toProductPayload(form.values)),
            });
            setProduct(updated);
            setEditing(false);
            notify({ tone: 'success', title: t('products.detail.savedFeedback') });
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    async function deleteProduct() {
        const confirmed = await confirm({
            title: t('products.detail.deleteTitle', { name: product?.name ?? '' }),
            description: t('products.detail.deleteConfirm'),
            confirmLabel: t('common.actions.delete'),
            tone: 'danger',
        });
        if (!confirmed) return;

        setBusy('delete-product');
        try {
            await api(`/products/${params.id}`, { method: 'DELETE' });
            notify({ tone: 'success', title: t('products.detail.deletedToast') });
            router.replace('/admin/produtos');
        } catch (err) {
            reportError(err);
            setBusy(undefined);
        }
    }

    if (error) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/produtos"
                    backLabel={t('products.detail.backLink')}
                    title={t('products.list.title')}
                />
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="grid gap-6">
                <PageHeader
                    backHref="/admin/produtos"
                    backLabel={t('products.detail.backLink')}
                    title={t('products.detail.loading')}
                />
                <SkeletonCards label={t('products.detail.loading')} />
            </div>
        );
    }

    return (
        <div className="grid gap-6">
            <PageHeader
                backHref="/admin/produtos"
                backLabel={t('products.detail.backLink')}
                kicker={t('products.detail.kicker')}
                meta={<span className="font-mono">/{product.slug}</span>}
                title={product.name}
                badge={
                    <StatusPill tone={publishedTone(product.isPublished)}>
                        {product.isPublished ? t('products.detail.view.published') : t('products.detail.view.draft')}
                    </StatusPill>
                }
                actions={
                    editing ? (
                        <Button
                            leadingIcon={<X className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => setEditing(false)}
                            variant="ghost"
                        >
                            {t('products.detail.form.cancel')}
                        </Button>
                    ) : (
                        <>
                            <Button
                                leadingIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => startEditing(product)}
                                variant="secondary"
                            >
                                {t('products.detail.editButton')}
                            </Button>
                            <Button
                                leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                                loading={busy === 'delete-product'}
                                onClick={deleteProduct}
                                variant="danger"
                            >
                                {t('products.detail.deleteButton')}
                            </Button>
                        </>
                    )
                }
            />

            {editing ? (
                <form className="grid gap-5" onSubmit={saveInfo}>
                    <ProductFormFields categories={categories} form={form} slugIsPublished={product.isPublished} />

                    <div className="flex flex-wrap justify-end gap-2">
                        <Button onClick={() => setEditing(false)} type="button" variant="ghost">
                            {t('products.detail.form.cancel')}
                        </Button>
                        <Button loading={busy === 'save-info'} type="submit">
                            {t('products.detail.form.save')}
                        </Button>
                    </div>
                </form>
            ) : (
                <SectionCard title={t('products.detail.infoSection')}>
                    <DescriptionList
                        items={[
                            {
                                label: t('products.detail.view.sourceType'),
                                value: productSourceLabel(product.marketplace),
                            },
                            {
                                label: t('products.detail.view.basePrice'),
                                value: `${minorToAmount(product.sourceAmountMinor)} CNY`,
                                numeric: true,
                            },
                            {
                                label: t('products.detail.view.estimatedShipping'),
                                value: product.estimatedShippingAmountMinor
                                    ? `${minorToAmount(product.estimatedShippingAmountMinor)} BRL`
                                    : t('common.dash'),
                                numeric: true,
                            },
                            { label: t('products.detail.view.stock'), value: product.stock, numeric: true },
                            {
                                label: t('products.detail.view.originUrl'),
                                value: product.marketplaceUrl ? (
                                    <a
                                        className="inline-flex items-center gap-1 break-all text-primary dark:text-night-accent"
                                        href={product.marketplaceUrl}
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        {product.marketplaceUrl}
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    </a>
                                ) : (
                                    t('products.detail.view.noOriginUrl')
                                ),
                                wide: true,
                            },
                            {
                                label: t('products.detail.view.categories'),
                                wide: true,
                                value:
                                    product.categories.length === 0 && product.subcategories.length === 0 ? (
                                        <span className="font-normal text-muted dark:text-night-muted">
                                            {t('products.detail.view.noCategories')}
                                        </span>
                                    ) : (
                                        <span className="flex flex-wrap gap-1.5">
                                            {[...product.categories, ...product.subcategories].map((entry) => (
                                                <StatusPill hideDot key={entry.id} tone="info">
                                                    {entry.name}
                                                </StatusPill>
                                            ))}
                                        </span>
                                    ),
                            },
                            {
                                label: t('products.detail.view.description'),
                                wide: true,
                                value: (
                                    <span className="block leading-relaxed font-normal whitespace-pre-wrap">
                                        {product.description}
                                    </span>
                                ),
                            },
                        ]}
                    />
                </SectionCard>
            )}

            {!editing && (
                <>
                    <ProductVariantsManager onChanged={load} productId={product.id} variants={product.variants} />
                    <ProductMediaManager media={product.media} onChanged={load} productId={product.id} />
                </>
            )}
        </div>
    );
}
