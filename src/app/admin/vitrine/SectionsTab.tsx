'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { SectionCard } from '@/components/admin/SectionCard';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { ProductPicker } from './ProductPicker';
import type { CategoryShortcut, HomeSection, HomeSectionKind } from './storefront-types';
import { TotpModal } from './TotpModal';

const SHELF_KINDS: HomeSectionKind[] = ['BEST_SELLING', 'NEWEST', 'CATEGORY', 'HAND_PICKED'];

/**
 * A home inteira, na ordem em que aparece. Os blocos fixos (atalhos de
 * categoria, feedbacks, CoinShop, chamada para a loja completa) só mudam de
 * lugar, de texto e de visibilidade; as prateleiras podem ser criadas e
 * apagadas. Salvar manda a lista toda de uma vez, com TOTP.
 */
export function SectionsTab() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [sections, setSections] = useState<HomeSection[]>();
    const [categories, setCategories] = useState<CategoryShortcut[]>([]);
    const [error, setError] = useState<string>();
    const [confirming, setConfirming] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        Promise.all([api<HomeSection[]>('/home/sections'), api<CategoryShortcut[]>('/home/categories')])
            .then(([loaded, cats]) => {
                setSections(loaded);
                setCategories(cats);
            })
            .catch(() => setError(t('storefront.loadError')));
    }, [t]);

    function update(index: number, patch: Partial<HomeSection>) {
        setSections((current) => current?.map((section, i) => (i === index ? { ...section, ...patch } : section)));
        setDirty(true);
    }

    function move(index: number, delta: number) {
        setSections((current) => {
            if (!current) return current;
            const next = [...current];
            const target = index + delta;
            if (target < 0 || target >= next.length) return current;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
        setDirty(true);
    }

    function addShelf() {
        setSections((current) => [
            ...(current ?? []),
            {
                kind: 'HAND_PICKED',
                fixed: false,
                title: t('storefront.sections.newShelfTitle'),
                subtitle: null,
                linkUrl: null,
                categories: [],
                products: [],
                itemLimit: 6,
                onlyReady: false,
                isVisible: false,
            },
        ]);
        setDirty(true);
    }

    async function save(totpCode: string) {
        const saved = await api<HomeSection[]>('/home/sections', {
            method: 'PUT',
            body: JSON.stringify({
                totpCode,
                sections: (sections ?? []).map((section) => ({
                    id: section.id,
                    kind: section.kind,
                    title: section.title?.trim() || null,
                    subtitle: section.subtitle?.trim() || null,
                    linkUrl: section.linkUrl?.trim() || null,
                    categoryIds: section.categories.map((category) => category.id),
                    productIds: section.products.map((product) => product.id),
                    itemLimit: section.itemLimit,
                    onlyReady: section.onlyReady,
                    isVisible: section.isVisible,
                })),
            }),
        });
        setSections(saved);
        setDirty(false);
        setConfirming(false);
        notify({ tone: 'success', title: t('storefront.sections.saved') });
    }

    if (error && !sections)
        return (
            <Alert tone="danger">
                <p>{error}</p>
            </Alert>
        );
    if (!sections) return <p className="text-sm text-muted dark:text-night-muted">{t('common.loading')}</p>;

    return (
        <SectionCard
            action={
                <div className="flex flex-wrap gap-2">
                    <Button onClick={addShelf} type="button" variant="secondary">
                        <Plus aria-hidden className="h-4 w-4" />
                        {t('storefront.sections.addShelf')}
                    </Button>
                    <Button disabled={!dirty} onClick={() => setConfirming(true)} type="button">
                        {t('storefront.sections.publish')}
                    </Button>
                </div>
            }
            description={t('storefront.sections.description')}
            title={t('storefront.sections.title')}
        >
            <ol className="m-0 grid list-none gap-3 p-0">
                {sections.map((section, index) => (
                    <li
                        className="grid gap-3 rounded-lg border border-line p-4 dark:border-night-line"
                        key={section.id ?? `new-${index}`}
                    >
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1">
                                <Button
                                    aria-label={t('storefront.sections.moveUp')}
                                    disabled={index === 0}
                                    iconOnly
                                    onClick={() => move(index, -1)}
                                    size="small"
                                    type="button"
                                    variant="ghost"
                                >
                                    <ArrowUp aria-hidden className="h-4 w-4" />
                                </Button>
                                <Button
                                    aria-label={t('storefront.sections.moveDown')}
                                    disabled={index === sections.length - 1}
                                    iconOnly
                                    onClick={() => move(index, 1)}
                                    size="small"
                                    type="button"
                                    variant="ghost"
                                >
                                    <ArrowDown aria-hidden className="h-4 w-4" />
                                </Button>
                            </span>
                            <strong className="min-w-0 flex-1 truncate text-sm">
                                {section.title || t(`storefront.kinds.${section.kind}`)}
                            </strong>
                            <span className="flex items-center gap-1 text-xs text-muted dark:text-night-muted">
                                {section.fixed && <Lock aria-hidden className="h-3.5 w-3.5" />}
                                {t(`storefront.kinds.${section.kind}`)}
                            </span>
                            <Checkbox
                                checked={section.isVisible}
                                label={t('storefront.sections.visible')}
                                onChange={(event) => update(index, { isVisible: event.target.checked })}
                            />
                            {!section.fixed && (
                                <Button
                                    aria-label={t('storefront.sections.remove')}
                                    iconOnly
                                    onClick={() => {
                                        setSections((current) => current?.filter((_, i) => i !== index));
                                        setDirty(true);
                                    }}
                                    size="small"
                                    type="button"
                                    variant="ghost"
                                >
                                    <Trash2 aria-hidden className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <Input
                                label={t('storefront.sections.fieldTitle')}
                                maxLength={80}
                                onChange={(event) => update(index, { title: event.target.value })}
                                value={section.title ?? ''}
                            />
                            {(section.kind === 'FEEDBACKS' ||
                                section.kind === 'COIN_SHOP' ||
                                section.kind === 'STORE_CTA') && (
                                <Input
                                    label={t('storefront.sections.fieldSubtitle')}
                                    maxLength={200}
                                    onChange={(event) => update(index, { subtitle: event.target.value })}
                                    value={section.subtitle ?? ''}
                                />
                            )}
                            <Input
                                hint={t('storefront.sections.linkHint')}
                                label={t('storefront.sections.fieldLink')}
                                maxLength={500}
                                onChange={(event) => update(index, { linkUrl: event.target.value })}
                                placeholder="/loja"
                                value={section.linkUrl ?? ''}
                            />
                            {!section.fixed && (
                                <>
                                    <Select
                                        disabled={Boolean(section.id)}
                                        hint={section.id ? t('storefront.sections.kindLocked') : undefined}
                                        label={t('storefront.sections.fieldSource')}
                                        onChange={(event) =>
                                            update(index, { kind: event.target.value as HomeSectionKind })
                                        }
                                        options={SHELF_KINDS.map((kind) => ({
                                            value: kind,
                                            label: t(`storefront.kinds.${kind}`),
                                        }))}
                                        value={section.kind}
                                    />
                                    <Input
                                        label={t('storefront.sections.fieldLimit')}
                                        max={24}
                                        min={1}
                                        onChange={(event) =>
                                            update(index, { itemLimit: Number(event.target.value) || 6 })
                                        }
                                        type="number"
                                        value={String(section.itemLimit)}
                                    />
                                    <Checkbox
                                        checked={section.onlyReady}
                                        label={t('storefront.sections.onlyReady')}
                                        onChange={(event) => update(index, { onlyReady: event.target.checked })}
                                    />
                                </>
                            )}
                        </div>

                        {section.kind === 'CATEGORY' && (
                            <fieldset className="m-0 flex flex-wrap gap-x-4 gap-y-2 border-0 p-0">
                                <legend className="mb-1 text-sm font-semibold">
                                    {t('storefront.sections.fieldCategories')}
                                </legend>
                                {categories.map((category) => (
                                    <Checkbox
                                        checked={section.categories.some((item) => item.id === category.id)}
                                        key={category.id}
                                        label={category.name}
                                        onChange={(event) =>
                                            update(index, {
                                                categories: event.target.checked
                                                    ? [...section.categories, category]
                                                    : section.categories.filter((item) => item.id !== category.id),
                                            })
                                        }
                                    />
                                ))}
                            </fieldset>
                        )}

                        {section.kind === 'HAND_PICKED' && (
                            <div className="grid gap-2">
                                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                                    {section.products.map((product) => (
                                        <li
                                            className="flex items-center gap-2 rounded-md border border-line px-2 py-1 text-xs dark:border-night-line"
                                            key={product.id}
                                        >
                                            {product.name}
                                            <button
                                                aria-label={t('storefront.sections.remove')}
                                                className="cursor-pointer text-muted"
                                                onClick={() =>
                                                    update(index, {
                                                        products: section.products.filter(
                                                            (item) => item.id !== product.id,
                                                        ),
                                                    })
                                                }
                                                type="button"
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {section.products.length < 24 && (
                                    <ProductPicker
                                        label={t('storefront.sections.addProduct')}
                                        onChange={(product) => {
                                            if (!product || section.products.some((item) => item.id === product.id))
                                                return;
                                            update(index, {
                                                products: [
                                                    ...section.products,
                                                    {
                                                        ...product,
                                                        slug: '',
                                                        isPublished: true,
                                                        inStock: true,
                                                        imageUrl: null,
                                                    },
                                                ],
                                            });
                                        }}
                                        value={null}
                                    />
                                )}
                            </div>
                        )}
                    </li>
                ))}
            </ol>

            <TotpModal
                description={t('storefront.sections.confirmDescription')}
                onClose={() => setConfirming(false)}
                onConfirm={save}
                open={confirming}
                title={t('storefront.sections.publish')}
            />
        </SectionCard>
    );
}
