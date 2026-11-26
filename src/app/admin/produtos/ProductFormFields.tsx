'use client';

import { useState, type ReactNode } from 'react';
import { SectionCard } from '@/components/admin/SectionCard';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { cny, type AdminCategory } from '@/types/api';
import { DEFAULT_ON_DEMAND_LEAD_DAYS, type ProductForm } from './product-form';

export interface ProductFormFieldsProps {
    form: ProductForm;
    categories: readonly AdminCategory[];
    /** Avisa que o slug já está no ar — mudá-lo quebra os links compartilhados. */
    slugIsPublished?: boolean;
    /** Tela de criação: a box ainda não tem conteúdo para publicar. */
    creating?: boolean;
}

/**
 * Campos de produto, usados tanto na criação quanto na edição. Cada bloco é
 * um cartão: o admin percorre identificação → preço →
 * disponibilidade → classificação sem perder de vista onde está. O tipo do
 * produto decide os blocos: Coin Shop e "Leve junto" são sempre estoque
 * próprio pronto, sem pré-venda, sob demanda nem categorias da vitrine.
 */
export function ProductFormFields({
    form,
    categories,
    slugIsPublished = false,
    creating = false,
}: ProductFormFieldsProps) {
    const { t } = useTranslation();
    const { values, patch, setName, setSlug, toggleCategory, toggleSubcategory } = form;
    const isStore = values.kind === 'STORE';
    const isCoinShop = values.kind === 'COIN_SHOP';
    const isCheckoutAddon = values.kind === 'CHECKOUT_ADDON';
    const isBox = values.kind === 'BOX';

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

            {isBox && (
                <SectionCard
                    description={t('products.new.box.periodDescription')}
                    title={t('products.new.box.periodTitle')}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            hint={t('products.new.box.periodHint')}
                            label={t('products.new.box.from')}
                            onChange={(event) => patch({ boxAvailableFrom: event.target.value })}
                            type="datetime-local"
                            value={values.boxAvailableFrom}
                        />
                        <Input
                            hint={t('products.new.box.periodHint')}
                            label={t('products.new.box.until')}
                            onChange={(event) => patch({ boxAvailableUntil: event.target.value })}
                            type="datetime-local"
                            value={values.boxAvailableUntil}
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
                        {!isBox && (
                            <CurrencyInput
                                currency="CNY"
                                hint={t('products.new.originPrice.costHint')}
                                label={t('products.new.originPrice.cost')}
                                minor={values.costAmountMinor}
                                onMinorChange={(minor) => patch({ costAmountMinor: minor })}
                            />
                        )}
                    </div>
                    {isBox && (
                        <p className="m-0 text-xs text-muted dark:text-night-muted">
                            {t('products.new.box.priceNote')}
                        </p>
                    )}
                    {!isCoinShop && !isBox && (
                        <p className="mt-2 text-xs text-muted dark:text-night-muted">
                            {unitMarginLabel(values.sourceAmountMinor, values.costAmountMinor, t)}
                        </p>
                    )}
                </div>
            </SectionCard>

            {isStore && (
                <FoldableSection
                    description={t('products.new.wholesale.description')}
                    hasData={values.salesChannel !== 'RETAIL_ONLY'}
                    title={t('products.new.wholesale.title')}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                            hint={t(`products.new.wholesale.channelHints.${values.salesChannel}`)}
                            label={t('products.new.wholesale.channel')}
                            onChange={(event) =>
                                patch({ salesChannel: event.target.value as typeof values.salesChannel })
                            }
                            options={[
                                { value: 'RETAIL_ONLY', label: t('products.new.wholesale.channels.RETAIL_ONLY') },
                                { value: 'WHOLESALE_ONLY', label: t('products.new.wholesale.channels.WHOLESALE_ONLY') },
                                { value: 'BOTH', label: t('products.new.wholesale.channels.BOTH') },
                            ]}
                            value={values.salesChannel}
                        />
                        <Input
                            hint={t('products.new.wholesale.unitsPerPackageHint')}
                            label={t('products.new.wholesale.unitsPerPackage')}
                            min={1}
                            onChange={(event) => patch({ unitsPerPackage: event.target.value })}
                            step={1}
                            type="number"
                            value={values.unitsPerPackage}
                        />
                        {values.salesChannel !== 'RETAIL_ONLY' && (
                            <CurrencyInput
                                currency="CNY"
                                hint={
                                    values.salesChannel === 'WHOLESALE_ONLY'
                                        ? t('products.new.wholesale.boxPriceHint')
                                        : t('products.new.wholesale.unitPriceHint')
                                }
                                label={
                                    values.salesChannel === 'WHOLESALE_ONLY'
                                        ? t('products.new.wholesale.boxPrice')
                                        : t('products.new.wholesale.unitPrice')
                                }
                                minor={values.wholesaleAmountMinor}
                                onMinorChange={(minor) => patch({ wholesaleAmountMinor: minor })}
                                required
                            />
                        )}
                        {values.salesChannel === 'BOTH' && (
                            <Input
                                hint={t('products.new.wholesale.minQuantityHint')}
                                label={t('products.new.wholesale.minQuantity')}
                                min={1}
                                onChange={(event) => patch({ wholesaleMinQuantity: event.target.value })}
                                required
                                step={1}
                                type="number"
                                value={values.wholesaleMinQuantity}
                            />
                        )}
                    </div>
                </FoldableSection>
            )}

            <SectionCard title={t('products.new.shippingStock.title')}>
                <div className="grid gap-4 sm:grid-cols-2">
                    {!isBox && (
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
                    )}
                    <Input
                        hint={
                            isBox
                                ? t('products.new.box.weightHint')
                                : isCheckoutAddon
                                  ? t('products.new.shippingStock.weightAddonHint')
                                  : t('products.new.shippingStock.weightHint')
                        }
                        label={t('products.new.shippingStock.weight')}
                        min={1}
                        onChange={(event) => patch({ weightGrams: event.target.value })}
                        required={isCheckoutAddon || isBox}
                        step={1}
                        type="number"
                        value={values.weightGrams}
                    />
                </div>

                {/* A box nasce rascunho: só vai ao ar depois de montada. */}
                {(!isBox || !creating) && (
                    <Checkbox
                        boxed
                        checked={values.isPublished}
                        className="mt-4"
                        description={t('products.new.publishHint')}
                        label={t('products.new.publishCheckbox')}
                        onChange={(event) => patch({ isPublished: event.target.checked })}
                    />
                )}
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
                {(isStore || isBox) && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Select
                            hint={t('products.new.languageHint')}
                            label={t('products.new.language')}
                            onChange={(event) => patch({ language: event.target.value })}
                            options={[
                                { value: '', label: t('products.new.notInformed') },
                                ...(['ZH', 'JA', 'EN', 'KO', 'PT', 'MULTI'] as const).map((code) => ({
                                    value: code,
                                    label: t(`products.new.languages.${code}`),
                                })),
                            ]}
                            value={values.language}
                        />
                        <Select
                            label={t('products.new.condition')}
                            onChange={(event) => patch({ condition: event.target.value })}
                            options={[
                                { value: '', label: t('products.new.notInformed') },
                                { value: 'SEALED', label: t('products.new.conditions.SEALED') },
                                { value: 'LOOSE', label: t('products.new.conditions.LOOSE') },
                            ]}
                            value={values.condition}
                        />
                        <Input
                            fieldClassName="sm:col-span-2"
                            hint={t('products.new.contentsHint')}
                            label={t('products.new.contents')}
                            maxLength={500}
                            onChange={(event) => patch({ contents: event.target.value })}
                            value={values.contents}
                        />
                    </div>
                )}
            </SectionCard>

            <FoldableSection
                description={t('products.new.invoice.description')}
                hasData={[
                    values.customsNameEn,
                    values.customsNameZh,
                    values.hsCode,
                    values.customsBrand,
                    values.customsMaterial,
                    values.customsPurpose,
                    values.customsElectricMagnetic,
                ].some((value) => value.trim() !== '')}
                title={t('products.new.invoice.title')}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                        label={t('products.new.invoice.nameEn')}
                        maxLength={64}
                        onChange={(event) => patch({ customsNameEn: event.target.value })}
                        placeholder="Trading cards"
                        value={values.customsNameEn}
                    />
                    <Input
                        label={t('products.new.invoice.nameZh')}
                        maxLength={100}
                        onChange={(event) => patch({ customsNameZh: event.target.value })}
                        placeholder="卡牌"
                        value={values.customsNameZh}
                    />
                    <Input
                        hint={t('products.new.invoice.hsCodeHint')}
                        inputMode="numeric"
                        label={t('products.new.invoice.hsCode')}
                        maxLength={12}
                        onChange={(event) => patch({ hsCode: event.target.value })}
                        pattern="\d{4,12}"
                        placeholder="9504400000"
                        value={values.hsCode}
                    />
                    <Input
                        label={t('products.new.invoice.brand')}
                        maxLength={100}
                        onChange={(event) => patch({ customsBrand: event.target.value })}
                        placeholder="Pokemon"
                        value={values.customsBrand}
                    />
                    <Input
                        label={t('products.new.invoice.material')}
                        maxLength={100}
                        onChange={(event) => patch({ customsMaterial: event.target.value })}
                        placeholder="Paper"
                        value={values.customsMaterial}
                    />
                    <Input
                        label={t('products.new.invoice.purpose')}
                        maxLength={200}
                        onChange={(event) => patch({ customsPurpose: event.target.value })}
                        placeholder="Collectible card game"
                        value={values.customsPurpose}
                    />
                    <Select
                        label={t('products.new.invoice.electricMagnetic')}
                        name="customsElectricMagnetic"
                        onChange={(event) =>
                            patch({
                                customsElectricMagnetic: event.target
                                    .value as ProductForm['values']['customsElectricMagnetic'],
                            })
                        }
                        options={[
                            { value: '', label: t('products.new.invoice.notInformed') },
                            { value: 'NO', label: t('products.new.invoice.no') },
                            { value: 'YES', label: t('products.new.invoice.yes') },
                        ]}
                        value={values.customsElectricMagnetic}
                    />
                </div>
            </FoldableSection>

            {isStore && (
                <SectionCard
                    description={t('products.new.availability.description')}
                    title={t('products.new.availability.title')}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* Pré-venda e sob demanda se excluem: uma escolha só. */}
                        <Select
                            label={t('products.new.availability.label')}
                            onChange={(event) => {
                                const next = event.target.value;
                                patch({
                                    isPreSale: next === 'PRESALE',
                                    isOnDemand: next === 'ON_DEMAND',
                                    // O backend apaga a data fora da pré-venda; a tela também.
                                    ...(next === 'PRESALE' ? {} : { releaseDate: '' }),
                                    ...(next === 'ON_DEMAND'
                                        ? {
                                              onDemandLeadDays:
                                                  values.onDemandLeadDays || String(DEFAULT_ON_DEMAND_LEAD_DAYS),
                                          }
                                        : {}),
                                });
                            }}
                            options={(['READY', 'PRESALE', 'ON_DEMAND'] as const).map((option) => ({
                                value: option,
                                label: t(`products.new.availability.options.${option}`),
                            }))}
                            value={values.isPreSale ? 'PRESALE' : values.isOnDemand ? 'ON_DEMAND' : 'READY'}
                        />
                        {values.isPreSale && (
                            <Input
                                hint={t('products.new.preSale.releaseDateHint')}
                                label={t('products.new.preSale.releaseDate')}
                                onChange={(event) => patch({ releaseDate: event.target.value })}
                                required
                                type="date"
                                value={values.releaseDate}
                            />
                        )}
                        {values.isOnDemand && (
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
                        )}
                    </div>
                    <p className="mt-3 mb-0 text-sm text-muted dark:text-night-muted">
                        {values.isPreSale
                            ? t('products.new.availability.preSaleHint')
                            : values.isOnDemand
                              ? t('products.new.availability.onDemandHint')
                              : t('products.new.availability.readyHint')}
                    </p>
                </SectionCard>
            )}

            {(isStore || isBox) && categories.length > 0 && (
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

/**
 * Cartão que começa fechado quando não tem dado (26/11/2026): atacado e
 * invoice só aparecem para quem precisa. Com dado, abre sozinho; o admin
 * pode abrir e fechar à vontade — o valor fica no formulário.
 */
function FoldableSection({
    title,
    description,
    hasData,
    children,
}: {
    title: string;
    description: string;
    hasData: boolean;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    const [toggled, setToggled] = useState<boolean>();
    const open = toggled ?? hasData;
    return (
        <SectionCard
            action={
                <Button onClick={() => setToggled(!open)} size="small" type="button" variant="ghost">
                    {open ? t('products.new.fold.hide') : t('products.new.fold.show')}
                </Button>
            }
            description={description}
            title={title}
        >
            {open ? children : null}
        </SectionCard>
    );
}
