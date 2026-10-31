'use client';

import { SectionCard } from '@/components/admin/SectionCard';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { cny, type AdminCategory } from '@/types/api';
import { DEFAULT_ON_DEMAND_LEAD_DAYS, type ProductForm } from './product-form';

export interface ProductFormFieldsProps {
    form: ProductForm;
    categories: readonly AdminCategory[];
    /** Avisa que o slug já está no ar — mudá-lo quebra os links compartilhados. */
    slugIsPublished?: boolean;
}

/**
 * Campos de produto, usados tanto na criação quanto na edição. Cada bloco é
 * um cartão: o admin percorre identificação → preço →
 * disponibilidade → classificação sem perder de vista onde está. O tipo do
 * produto decide os blocos: Coin Shop e "Leve junto" são sempre estoque
 * próprio pronto, sem pré-venda, sob demanda nem categorias da vitrine.
 */
export function ProductFormFields({ form, categories, slugIsPublished = false }: ProductFormFieldsProps) {
    const { t } = useTranslation();
    const { values, patch, setName, setSlug, toggleCategory, toggleSubcategory } = form;
    const isStore = values.kind === 'STORE';
    const isCoinShop = values.kind === 'COIN_SHOP';
    const isCheckoutAddon = values.kind === 'CHECKOUT_ADDON';

    return (
        <>
            {isCoinShop && (
                <SectionCard description={t('products.new.coins.description')} title={t('products.new.coins.title')}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            hint={t('products.new.coins.priceHint')}
                            label={t('products.new.coins.price')}
                            min={1}
                            onChange={(event) => patch({ coinPrice: event.target.value })}
                            required
                            step={1}
                            type="number"
                            value={values.coinPrice}
                        />
                        <Input
                            hint={t('products.new.coins.limitHint')}
                            label={t('products.new.coins.limit')}
                            min={1}
                            onChange={(event) => patch({ coinRedeemLimitPerUser: event.target.value })}
                            step={1}
                            type="number"
                            value={values.coinRedeemLimitPerUser}
                        />
                        <Input
                            label={t('products.new.coins.from')}
                            onChange={(event) => patch({ coinAvailableFrom: event.target.value })}
                            type="datetime-local"
                            value={values.coinAvailableFrom}
                        />
                        <Input
                            label={t('products.new.coins.until')}
                            onChange={(event) => patch({ coinAvailableUntil: event.target.value })}
                            type="datetime-local"
                            value={values.coinAvailableUntil}
                        />
                    </div>
                </SectionCard>
            )}

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
                    isCoinShop
                        ? t('products.new.originPrice.descriptionCoinShop')
                        : t('products.new.originPrice.descriptionMaoMaoBuy')
                }
                title={
                    isCoinShop
                        ? t('products.new.originPrice.titleCoinShop')
                        : t('products.new.originPrice.titleMaoMaoBuy')
                }
            >
                <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <CurrencyInput
                            currency="CNY"
                            hint={isCoinShop ? t('products.new.originPrice.referenceHint') : undefined}
                            label={
                                isCoinShop
                                    ? t('products.new.originPrice.referencePrice')
                                    : t('products.new.originPrice.salePriceCny')
                            }
                            minor={values.sourceAmountMinor}
                            onMinorChange={(minor) => patch({ sourceAmountMinor: minor })}
                            required={!isCoinShop}
                        />
                        <CurrencyInput
                            currency="CNY"
                            hint={t('products.new.originPrice.costHint')}
                            label={t('products.new.originPrice.cost')}
                            minor={values.costAmountMinor}
                            onMinorChange={(minor) => patch({ costAmountMinor: minor })}
                        />
                    </div>
                    {!isCoinShop && (
                        <p className="mt-2 text-xs text-muted dark:text-night-muted">
                            {unitMarginLabel(values.sourceAmountMinor, values.costAmountMinor, t)}
                        </p>
                    )}
                </div>
            </SectionCard>

            <SectionCard title={t('products.new.shippingStock.title')}>
                <div className="grid gap-4 sm:grid-cols-2">
                    {isStore && (
                        <CurrencyInput
                            currency="BRL"
                            hint={t('products.new.shippingStock.estimatedShippingHint')}
                            label={t('products.new.shippingStock.estimatedShipping')}
                            minor={values.estimatedShippingAmountMinor}
                            onMinorChange={(minor) => patch({ estimatedShippingAmountMinor: minor })}
                        />
                    )}
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
                    <Input
                        hint={
                            isCheckoutAddon
                                ? t('products.new.shippingStock.weightAddonHint')
                                : t('products.new.shippingStock.weightHint')
                        }
                        label={t('products.new.shippingStock.weight')}
                        min={1}
                        onChange={(event) => patch({ weightGrams: event.target.value })}
                        required={isCheckoutAddon}
                        step={1}
                        type="number"
                        value={values.weightGrams}
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
                {isStore && (
                    <Checkbox
                        boxed
                        checked={values.isChinaExclusive}
                        className="mt-3"
                        description={t('products.new.chinaExclusiveHint')}
                        label={t('products.new.chinaExclusiveCheckbox')}
                        onChange={(event) => patch({ isChinaExclusive: event.target.checked })}
                    />
                )}
            </SectionCard>

            {isStore && (
                <SectionCard
                    description={t('products.new.preSale.description')}
                    title={t('products.new.preSale.title')}
                >
                    <Checkbox
                        boxed
                        checked={values.isPreSale}
                        description={t('products.new.preSale.checkboxHint')}
                        label={t('products.new.preSale.checkbox')}
                        // Desmarcar limpa a data no mesmo gesto: o backend a apaga
                        // de qualquer jeito, e deixá-la na tela sugere que ela
                        // continua valendo.
                        // Pré-venda e sob demanda se excluem: marcar uma desmarca a outra.
                        onChange={(event) =>
                            patch({
                                isPreSale: event.target.checked,
                                ...(event.target.checked ? { isOnDemand: false } : { releaseDate: '' }),
                            })
                        }
                    />
                    {values.isPreSale && (
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <Input
                                hint={t('products.new.preSale.releaseDateHint')}
                                label={t('products.new.preSale.releaseDate')}
                                onChange={(event) => patch({ releaseDate: event.target.value })}
                                required
                                type="date"
                                value={values.releaseDate}
                            />
                        </div>
                    )}
                </SectionCard>
            )}

            {isStore && (
                <SectionCard
                    description={t('products.new.onDemand.description')}
                    title={t('products.new.onDemand.title')}
                >
                    <Checkbox
                        boxed
                        checked={values.isOnDemand}
                        description={t('products.new.onDemand.checkboxHint')}
                        label={t('products.new.onDemand.checkbox')}
                        onChange={(event) =>
                            patch({
                                isOnDemand: event.target.checked,
                                ...(event.target.checked
                                    ? {
                                          isPreSale: false,
                                          releaseDate: '',
                                          onDemandLeadDays:
                                              values.onDemandLeadDays || String(DEFAULT_ON_DEMAND_LEAD_DAYS),
                                      }
                                    : {}),
                            })
                        }
                    />
                    {values.isOnDemand && (
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <Input
                                hint={t('products.new.onDemand.leadDaysHint')}
                                label={t('products.new.onDemand.leadDays')}
                                max={60}
                                min={1}
                                onChange={(event) => patch({ onDemandLeadDays: event.target.value })}
                                required
                                step={1}
                                type="number"
                                value={values.onDemandLeadDays}
                            />
                        </div>
                    )}
                </SectionCard>
            )}

            {isStore && categories.length > 0 && (
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

/** "Sobra ¥45,00 por unidade (34,6% do preço)" — ou o aviso de custo pendente. */
function unitMarginLabel(priceMinor: string, costMinor: string, t: ReturnType<typeof useTranslation>['t']): string {
    if (costMinor === '0') return t('products.new.originPrice.marginMissing');
    const price = Number(priceMinor);
    const profit = price - Number(costMinor);
    const percent = price > 0 ? ((profit / price) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0';
    return t('products.new.originPrice.margin', { profit: cny(profit), percent: `${percent}%` });
}
