'use client';

import { Globe, Store } from 'lucide-react';
import { SectionCard } from '@/components/admin/SectionCard';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { MARKETPLACE_NAMES, type AdminCategory } from '@/types/api';
import type { ProductForm, ProductSourceType } from './product-form';

const SOURCE_OPTIONS: Array<{
    value: ProductSourceType;
    titleKey: 'products.new.sourceType.marketplaceTitle' | 'products.new.sourceType.maomaobuyTitle';
    descriptionKey: 'products.new.sourceType.marketplaceDescription' | 'products.new.sourceType.maomaobuyDescription';
    icon: typeof Store;
}> = [
    {
        value: 'MARKETPLACE',
        titleKey: 'products.new.sourceType.marketplaceTitle',
        descriptionKey: 'products.new.sourceType.marketplaceDescription',
        icon: Globe,
    },
    {
        value: 'MAOMAOBUY',
        titleKey: 'products.new.sourceType.maomaobuyTitle',
        descriptionKey: 'products.new.sourceType.maomaobuyDescription',
        icon: Store,
    },
];

export interface ProductFormFieldsProps {
    form: ProductForm;
    categories: readonly AdminCategory[];
    /** Avisa que o slug já está no ar — mudá-lo quebra os links compartilhados. */
    slugIsPublished?: boolean;
}

/**
 * Campos comuns de produto, usados tanto na criação quanto na edição. Cada
 * bloco é um cartão: o admin percorre origem → identificação → preço →
 * disponibilidade → classificação sem perder de vista onde está.
 */
export function ProductFormFields({ form, categories, slugIsPublished = false }: ProductFormFieldsProps) {
    const { t } = useTranslation();
    const { values, patch, setName, setSlug, toggleCategory, toggleSubcategory } = form;
    const isOwnStock = values.sourceType === 'MAOMAOBUY';

    return (
        <>
            <SectionCard
                description={t('products.new.sourceType.description')}
                title={t('products.new.sourceType.legend')}
            >
                <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2">
                    <legend className="sr-only">{t('products.new.sourceType.legend')}</legend>
                    {SOURCE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const selected = values.sourceType === option.value;
                        return (
                            <label
                                className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition ${
                                    selected
                                        ? 'border-brand-400 bg-brand-50 dark:border-night-accent/40 dark:bg-night-brand'
                                        : 'border-line hover:border-brand-300 dark:border-night-line'
                                }`}
                                key={option.value}
                            >
                                <input
                                    checked={selected}
                                    className="sr-only"
                                    name="sourceType"
                                    onChange={() => patch({ sourceType: option.value })}
                                    type="radio"
                                />
                                <span className="flex items-center gap-2 text-sm font-bold text-ink dark:text-night-text">
                                    <Icon
                                        className="h-4 w-4 shrink-0 text-primary dark:text-night-accent"
                                        aria-hidden="true"
                                    />
                                    {t(option.titleKey)}
                                </span>
                                <span className="text-xs leading-relaxed text-muted dark:text-night-muted">
                                    {t(option.descriptionKey)}
                                </span>
                            </label>
                        );
                    })}
                </fieldset>
            </SectionCard>

            <SectionCard title={t('products.new.basicInfo.title')}>
                <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label={t('products.new.basicInfo.name')}
                            maxLength={300}
                            minLength={1}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={t('products.new.basicInfo.namePlaceholder')}
                            required
                            value={values.name}
                        />
                        <Input
                            className="font-mono"
                            hint={
                                slugIsPublished
                                    ? t('products.detail.form.slugPublishedHint')
                                    : t('products.new.basicInfo.slugHint')
                            }
                            label={t('products.new.basicInfo.slug')}
                            onChange={(event) => setSlug(event.target.value)}
                            pattern="[a-z0-9]+(-[a-z0-9]+)*"
                            required
                            value={values.slug}
                        />
                    </div>
                    <Textarea
                        label={t('products.new.basicInfo.description')}
                        maxLength={20000}
                        minLength={1}
                        onChange={(event) => patch({ description: event.target.value })}
                        placeholder={t('products.new.basicInfo.descriptionPlaceholder')}
                        required
                        rows={6}
                        value={values.description}
                    />
                </div>
            </SectionCard>

            <SectionCard
                description={
                    isOwnStock
                        ? t('products.new.originPrice.descriptionMaoMaoBuy')
                        : t('products.new.originPrice.descriptionMarketplace')
                }
                title={
                    isOwnStock
                        ? t('products.new.originPrice.titleMaoMaoBuy')
                        : t('products.new.originPrice.titleMarketplace')
                }
            >
                <div className="grid gap-4">
                    {!isOwnStock && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Select
                                label={t('products.new.originPrice.marketplace')}
                                onChange={(event) => patch({ marketplace: event.target.value })}
                                options={MARKETPLACE_NAMES.map((name) => ({ value: name, label: name }))}
                                required
                                value={values.marketplace}
                            />
                            <Input
                                label={t('products.new.originPrice.originUrl')}
                                onChange={(event) => patch({ marketplaceUrl: event.target.value })}
                                placeholder="https://item.taobao.com/item.htm?id=123"
                                required
                                type="url"
                                value={values.marketplaceUrl}
                            />
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <CurrencyInput
                            currency="CNY"
                            label={
                                isOwnStock
                                    ? t('products.new.originPrice.salePriceCny')
                                    : t('products.new.originPrice.basePrice')
                            }
                            minor={values.sourceAmountMinor}
                            onMinorChange={(minor) => patch({ sourceAmountMinor: minor })}
                            required
                        />
                    </div>
                </div>
            </SectionCard>

            <SectionCard title={t('products.new.shippingStock.title')}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <CurrencyInput
                        currency="BRL"
                        hint={t('products.new.shippingStock.estimatedShippingHint')}
                        label={t('products.new.shippingStock.estimatedShipping')}
                        minor={values.estimatedShippingAmountMinor}
                        onMinorChange={(minor) => patch({ estimatedShippingAmountMinor: minor })}
                    />
                    <Input
                        hint={t('products.new.shippingStock.stockHint')}
                        label={t('products.new.shippingStock.stock')}
                        min={0}
                        onChange={(event) => patch({ stock: event.target.value })}
                        placeholder="0"
                        required
                        step={1}
                        type="number"
                        value={values.stock}
                    />
                </div>

                <Checkbox
                    boxed
                    checked={values.isPublished}
                    className="mt-4"
                    description={t('products.new.publishHint')}
                    label={t('products.new.publishCheckbox')}
                    onChange={(event) => patch({ isPublished: event.target.checked })}
                />
            </SectionCard>

            {categories.length > 0 && (
                <SectionCard
                    description={t('products.new.categoriesDescription')}
                    title={t('products.new.categoriesTitle')}
                >
                    <div className="grid gap-4">
                        {categories.map((category) => (
                            <div key={category.id}>
                                <Checkbox
                                    checked={values.categoryIds.includes(category.id)}
                                    label={category.name}
                                    onChange={() => toggleCategory(category.id)}
                                />
                                {category.subcategories.length > 0 && (
                                    <div className="mt-2 ml-6 flex flex-wrap gap-x-5 gap-y-2">
                                        {category.subcategories.map((subcategory) => (
                                            <Checkbox
                                                checked={values.subcategoryIds.includes(subcategory.id)}
                                                key={subcategory.id}
                                                label={
                                                    <span className="font-normal text-muted dark:text-night-muted">
                                                        {subcategory.name}
                                                    </span>
                                                }
                                                onChange={() => toggleSubcategory(subcategory.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
        </>
    );
}
