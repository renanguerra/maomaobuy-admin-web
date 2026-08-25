'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { api, ApiError } from '@/services/api';
import { MARKETPLACE_NAMES, productSourceLabel, type AdminCategory, type AdminProduct } from '@/types/api';
import { ProductMediaManager } from '../ProductMediaManager';
import { minorToAmount } from './ProductDetailPage.utils';

export function ProductDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [product, setProduct] = useState<AdminProduct>();
    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
    const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string>();
    const [feedback, setFeedback] = useState<string>();
    const [editingInfo, setEditingInfo] = useState(false);
    const [editSourceType, setEditSourceType] = useState<'MARKETPLACE' | 'MAOMAOBUY'>('MARKETPLACE');
    const [editAmountMinor, setEditAmountMinor] = useState('0');
    const [editShippingAmountMinor, setEditShippingAmountMinor] = useState('0');
    const [editStock, setEditStock] = useState('0');
    const [addingVariant, setAddingVariant] = useState(false);
    const [newVariantAmountMinor, setNewVariantAmountMinor] = useState('0');
    const [editingVariantId, setEditingVariantId] = useState<string>();
    const [editVariantAmountMinor, setEditVariantAmountMinor] = useState('0');
    const [busy, setBusy] = useState<string>();

    function load() {
        api<AdminProduct>(`/products/${params.id}`)
            .then((loaded) => {
                setProduct(loaded);
                setSelectedCategoryIds(new Set(loaded.categories.map((category) => category.id)));
                setSelectedSubcategoryIds(new Set(loaded.subcategories.map((subcategory) => subcategory.id)));
            })
            .catch(() => setError('Não foi possível carregar o produto.'));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);

    useEffect(() => {
        api<AdminCategory[]>('/categories')
            .then(setCategories)
            .catch(() => {
                /* seleção de categorias é opcional; falha silenciosa aqui */
            });
    }, []);

    function toggleCategory(id: string) {
        setSelectedCategoryIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleSubcategory(id: string) {
        setSelectedSubcategoryIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function errorMessage(err: unknown) {
        return err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.';
    }

    async function saveInfo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (String(data.get('sourceAmount')) === '0') {
            setError('Informe um preço base maior que zero.');
            return;
        }
        setBusy('save-info');
        setError(undefined);
        try {
            const updated = await api<AdminProduct>(`/products/${params.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name: String(data.get('name')),
                    slug: String(data.get('slug')),
                    description: String(data.get('description')),
                    marketplace: editSourceType === 'MAOMAOBUY' ? 'MAOMAOBUY' : String(data.get('marketplace')),
                    marketplaceUrl: editSourceType === 'MAOMAOBUY' ? undefined : String(data.get('marketplaceUrl')),
                    sourceCurrency: editSourceType === 'MAOMAOBUY' ? 'BRL' : String(data.get('sourceCurrency')),
                    sourceAmountMinor: String(data.get('sourceAmount')),
                    estimatedShippingAmountMinor: String(data.get('shippingAmount')),
                    stock: Number(data.get('stock')),
                    isPublished: data.get('isPublished') === 'on',
                    categoryIds: Array.from(selectedCategoryIds),
                    subcategoryIds: Array.from(selectedSubcategoryIds),
                }),
            });
            setProduct(updated);
            setSelectedCategoryIds(new Set(updated.categories.map((category) => category.id)));
            setSelectedSubcategoryIds(new Set(updated.subcategories.map((subcategory) => subcategory.id)));
            setEditingInfo(false);
            setFeedback('Produto atualizado.');
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function deleteProduct() {
        if (!confirm('Remover este produto definitivamente?')) return;
        setBusy('delete-product');
        try {
            await api(`/products/${params.id}`, { method: 'DELETE' });
            router.replace('/admin/produtos');
        } catch (err) {
            setError(errorMessage(err));
            setBusy(undefined);
        }
    }

    async function createVariant(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy('create-variant');
        setError(undefined);
        try {
            await api(`/products/${params.id}/variants`, {
                method: 'POST',
                body: JSON.stringify({
                    externalId: String(data.get('externalId')),
                    label: String(data.get('label')),
                    amountAdjustmentMinor: String(data.get('amountAdjustment')),
                    isAvailable: data.get('isAvailable') === 'on',
                }),
            });
            form.reset();
            setAddingVariant(false);
            setNewVariantAmountMinor('0');
            load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function updateVariant(variantId: string, event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(`update-variant:${variantId}`);
        setError(undefined);
        try {
            await api(`/products/${params.id}/variants/${variantId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    externalId: String(data.get('externalId')),
                    label: String(data.get('label')),
                    amountAdjustmentMinor: String(data.get('amountAdjustment')),
                    isAvailable: data.get('isAvailable') === 'on',
                }),
            });
            setEditingVariantId(undefined);
            load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function deleteVariant(variantId: string) {
        if (!confirm('Remover esta variante?')) return;
        setBusy(`delete-variant:${variantId}`);
        setError(undefined);
        try {
            await api(`/products/${params.id}/variants/${variantId}`, { method: 'DELETE' });
            load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    return (
        <main>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-muted dark:text-night-muted" href="/admin/produtos">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar para produtos
            </Link>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {feedback && <p className="mt-4 text-sm text-success">{feedback}</p>}
            {!product && !error && <p className="mt-6 text-muted">Carregando produto…</p>}

            {product && (
                <>
                    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="mm-kicker mb-3">Produto</p>
                            <h1 className="m-0 text-3xl tracking-[-.03em]">{product.name}</h1>
                            <p className="mt-1 text-sm text-muted dark:text-night-muted">/{product.slug}</p>
                        </div>
                        <div className="flex gap-3">
                            {!editingInfo && (
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setEditSourceType(product.marketplace === 'MAOMAOBUY' ? 'MAOMAOBUY' : 'MARKETPLACE');
                                        setEditAmountMinor(product.sourceAmountMinor);
                                        setEditShippingAmountMinor(product.estimatedShippingAmountMinor ?? '0');
                                        setEditStock(String(product.stock));
                                        setEditingInfo(true);
                                    }}
                                    leadingIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                                >
                                    Editar
                                </Button>
                            )}
                            <Button variant="danger" onClick={deleteProduct} loading={busy === 'delete-product'} leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
                                Excluir
                            </Button>
                        </div>
                    </div>

                    {editingInfo ? (
                        <section className="mm-panel mt-8 p-6">
                            <form className="grid gap-4" onSubmit={saveInfo}>
                                <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                                    <label className="grid gap-2 text-sm font-semibold">
                                        Nome
                                        <input className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas" name="name" defaultValue={product.name} placeholder="Ex.: Camiseta MaoMao" required />
                                    </label>
                                    <label className="grid gap-2 text-sm font-semibold">
                                        Slug
                                        <input className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas" name="slug" defaultValue={product.slug} placeholder="camiseta-maomao" required />
                                    </label>
                                </div>
                                <label className="grid gap-2 text-sm font-semibold">
                                    Descrição
                                    <textarea
                                        className="min-h-32 rounded-md border border-line bg-surface px-3 py-2 dark:border-night-line dark:bg-night-canvas"
                                        name="description"
                                        defaultValue={product.description}
                                        placeholder="Descreva o produto para o cliente"
                                        required
                                    />
                                </label>
                                <fieldset className="grid gap-2">
                                    <legend className="mb-1 text-sm font-semibold">Tipo de produto</legend>
                                    <div className="flex flex-wrap gap-4">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="editSourceType"
                                                className="h-4 w-4"
                                                checked={editSourceType === 'MARKETPLACE'}
                                                onChange={() => setEditSourceType('MARKETPLACE')}
                                            />
                                            Marketplace (Taobao/Xianyu/Alibaba)
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="editSourceType"
                                                className="h-4 w-4"
                                                checked={editSourceType === 'MAOMAOBUY'}
                                                onChange={() => setEditSourceType('MAOMAOBUY')}
                                            />
                                            MaoMaoBuy (estoque próprio)
                                        </label>
                                    </div>
                                </fieldset>

                                {editSourceType === 'MARKETPLACE' ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                                            <label className="grid gap-2 text-sm font-semibold">
                                                Marketplace
                                                <select
                                                    className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                                    name="marketplace"
                                                    defaultValue={MARKETPLACE_NAMES.includes(product.marketplace as (typeof MARKETPLACE_NAMES)[number]) ? product.marketplace : MARKETPLACE_NAMES[0]}
                                                    required
                                                >
                                                    {MARKETPLACE_NAMES.map((name) => (
                                                        <option key={name} value={name}>
                                                            {name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="grid gap-2 text-sm font-semibold">
                                                URL de origem
                                                <input
                                                    className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                                    name="marketplaceUrl"
                                                    type="url"
                                                    defaultValue={product.marketplaceUrl ?? ''}
                                                    placeholder="https://item.taobao.com/item.htm?id=123"
                                                    required
                                                />
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                                            <label className="grid gap-2 text-sm font-semibold">
                                                Moeda de origem
                                                <select
                                                    className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                                    name="sourceCurrency"
                                                    defaultValue={product.sourceCurrency}
                                                    required
                                                >
                                                    <option value="CNY">CNY</option>
                                                    <option value="BRL">BRL</option>
                                                </select>
                                            </label>
                                            <label className="grid gap-2 text-sm font-semibold">
                                                Preço base
                                                <CurrencyInput
                                                    className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                                    name="sourceAmount"
                                                    minor={editAmountMinor}
                                                    onMinorChange={setEditAmountMinor}
                                                    required
                                                />
                                            </label>
                                        </div>
                                    </>
                                ) : (
                                    <label className="grid max-w-[calc(50%-0.5rem)] gap-2 text-sm font-semibold max-[600px]:max-w-full">
                                        Preço de venda (BRL)
                                        <CurrencyInput
                                            className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            name="sourceAmount"
                                            minor={editAmountMinor}
                                            onMinorChange={setEditAmountMinor}
                                            required
                                        />
                                    </label>
                                )}
                                <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                                    <label className="grid gap-2 text-sm font-semibold">
                                        Frete estimado (BRL, opcional)
                                        <CurrencyInput
                                            className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            name="shippingAmount"
                                            minor={editShippingAmountMinor}
                                            onMinorChange={setEditShippingAmountMinor}
                                        />
                                        <span className="font-normal text-muted dark:text-night-muted">
                                            Só informativo — mostrado ao cliente na página do produto, não é cobrado com o pedido.
                                        </span>
                                    </label>
                                    <label className="grid gap-2 text-sm font-semibold">
                                        Estoque
                                        <input
                                            className="min-h-11 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            name="stock"
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={editStock}
                                            onChange={(event) => setEditStock(event.target.value)}
                                            placeholder="0"
                                            required
                                        />
                                        <span className="font-normal text-muted dark:text-night-muted">
                                            Unidades disponíveis. Só é debitado quando o pedido é aprovado e liberado para pagamento.
                                        </span>
                                    </label>
                                </div>

                                <label className="flex items-center gap-3 text-sm font-semibold">
                                    <input name="isPublished" type="checkbox" className="h-4 w-4" defaultChecked={product.isPublished} />
                                    Publicado
                                </label>

                                {categories.length > 0 && (
                                    <section>
                                        <h2 className="m-0 text-lg">Categorias</h2>
                                        <div className="mt-3 grid gap-4">
                                            {categories.map((category) => (
                                                <div key={category.id}>
                                                    <label className="flex items-center gap-2 text-sm font-semibold">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4"
                                                            checked={selectedCategoryIds.has(category.id)}
                                                            onChange={() => toggleCategory(category.id)}
                                                        />
                                                        {category.name}
                                                    </label>
                                                    {category.subcategories.length > 0 && (
                                                        <div className="mt-2 ml-6 flex flex-wrap gap-4">
                                                            {category.subcategories.map((subcategory) => (
                                                                <label className="flex items-center gap-2 text-sm" key={subcategory.id}>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4"
                                                                        checked={selectedSubcategoryIds.has(subcategory.id)}
                                                                        onChange={() => toggleSubcategory(subcategory.id)}
                                                                    />
                                                                    {subcategory.name}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                <div className="flex gap-3">
                                    <Button type="submit" loading={busy === 'save-info'}>
                                        Salvar alterações
                                    </Button>
                                    <Button type="button" variant="ghost" onClick={() => setEditingInfo(false)}>
                                        Cancelar
                                    </Button>
                                </div>
                            </form>
                        </section>
                    ) : (
                        <section className="mm-panel mt-8 grid grid-cols-2 gap-6 p-6 max-[600px]:grid-cols-1">
                            <div>
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Tipo de produto</p>
                                <p className="mt-1 font-semibold">{productSourceLabel(product.marketplace)}</p>
                            </div>
                            <div>
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Preço base</p>
                                <p className="mm-data mt-1 font-semibold">{minorToAmount(product.sourceAmountMinor)} {product.sourceCurrency}</p>
                            </div>
                            <div>
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Frete estimado</p>
                                <p className="mm-data mt-1 font-semibold">
                                    {product.estimatedShippingAmountMinor ? `${minorToAmount(product.estimatedShippingAmountMinor)} BRL` : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Status</p>
                                <p className="mt-1">
                                    <span className="mm-kicker">{product.isPublished ? 'Publicado' : 'Rascunho'}</span>
                                </p>
                            </div>
                            <div>
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Estoque</p>
                                <p className="mm-data mt-1 font-semibold">{product.stock}</p>
                            </div>
                            <div>
                                <p className="m-0 text-sm text-muted dark:text-night-muted">URL de origem</p>
                                {product.marketplaceUrl ? (
                                    <a className="mt-1 block truncate text-primary" href={product.marketplaceUrl} target="_blank" rel="noreferrer">
                                        {product.marketplaceUrl}
                                    </a>
                                ) : (
                                    <p className="mt-1 text-muted dark:text-night-muted">— (estoque próprio, sem link de origem)</p>
                                )}
                            </div>
                            <div className="col-span-2">
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Descrição</p>
                                <p className="mt-1 whitespace-pre-wrap">{product.description}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="m-0 text-sm text-muted dark:text-night-muted">Categorias</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {product.categories.map((category) => (
                                        <span className="mm-kicker" key={category.id}>
                                            {category.name}
                                        </span>
                                    ))}
                                    {product.subcategories.map((subcategory) => (
                                        <span className="mm-kicker" key={subcategory.id}>
                                            {subcategory.name}
                                        </span>
                                    ))}
                                    {product.categories.length === 0 && product.subcategories.length === 0 && (
                                        <span className="text-sm text-muted dark:text-night-muted">Nenhuma categoria vinculada.</span>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="mt-10">
                        <div className="flex items-center justify-between">
                            <h2 className="m-0 text-xl">Variantes</h2>
                            {!addingVariant && (
                                <Button
                                    size="small"
                                    variant="ghost"
                                    onClick={() => {
                                        setNewVariantAmountMinor('0');
                                        setAddingVariant(true);
                                    }}
                                    leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                >
                                    Adicionar variante
                                </Button>
                            )}
                        </div>

                        {addingVariant && (
                            <form
                                className="mm-panel-soft mt-4 grid grid-cols-[1fr_1fr_120px_auto_auto] items-end gap-3 p-4 max-[700px]:grid-cols-1"
                                onSubmit={createVariant}
                            >
                                <label className="grid gap-1 text-xs font-semibold">
                                    ID externo
                                    <input className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas" name="externalId" placeholder="Ex.: P-42-azul" required />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold">
                                    Rótulo
                                    <input className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas" name="label" placeholder="Ex.: Azul, tamanho 42" required />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold">
                                    Ajuste
                                    <CurrencyInput
                                        className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                        name="amountAdjustment"
                                        minor={newVariantAmountMinor}
                                        onMinorChange={setNewVariantAmountMinor}
                                    />
                                </label>
                                <label className="flex h-10 items-center gap-2 text-xs font-semibold">
                                    <input name="isAvailable" type="checkbox" className="h-4 w-4" defaultChecked />
                                    Disponível
                                </label>
                                <div className="flex gap-2">
                                    <Button size="small" type="submit" loading={busy === 'create-variant'}>
                                        Adicionar
                                    </Button>
                                    <Button size="small" type="button" variant="ghost" onClick={() => setAddingVariant(false)}>
                                        <X className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            </form>
                        )}

                        <div className="mt-4 grid gap-3">
                            {product.variants.map((variant) =>
                                editingVariantId === variant.id ? (
                                    <form
                                        className="mm-panel-soft grid grid-cols-[1fr_1fr_120px_auto_auto] items-end gap-3 p-4 max-[700px]:grid-cols-1"
                                        key={variant.id}
                                        onSubmit={(event) => updateVariant(variant.id, event)}
                                    >
                                        <label className="grid gap-1 text-xs font-semibold">
                                            ID externo
                                            <input
                                                className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                                name="externalId"
                                                defaultValue={variant.externalId}
                                                placeholder="Ex.: P-42-azul"
                                                required
                                            />
                                        </label>
                                        <label className="grid gap-1 text-xs font-semibold">
                                            Rótulo
                                            <input
                                                className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                                name="label"
                                                defaultValue={variant.label}
                                                placeholder="Ex.: Azul, tamanho 42"
                                                required
                                            />
                                        </label>
                                        <label className="grid gap-1 text-xs font-semibold">
                                            Ajuste
                                            <CurrencyInput
                                                className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                                name="amountAdjustment"
                                                minor={editVariantAmountMinor}
                                                onMinorChange={setEditVariantAmountMinor}
                                            />
                                        </label>
                                        <label className="flex h-10 items-center gap-2 text-xs font-semibold">
                                            <input name="isAvailable" type="checkbox" className="h-4 w-4" defaultChecked={variant.isAvailable} />
                                            Disponível
                                        </label>
                                        <div className="flex gap-2">
                                            <Button size="small" type="submit" loading={busy === `update-variant:${variant.id}`}>
                                                Salvar
                                            </Button>
                                            <Button size="small" type="button" variant="ghost" onClick={() => setEditingVariantId(undefined)}>
                                                <X className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="mm-panel-soft flex flex-wrap items-center justify-between gap-4 p-4" key={variant.id}>
                                        <div>
                                            <strong>{variant.label}</strong>
                                            <p className="mt-0.5 text-sm text-muted dark:text-night-muted">
                                                {variant.externalId} · ajuste {minorToAmount(variant.amountAdjustmentMinor)} ·{' '}
                                                {variant.isAvailable ? 'disponível' : 'indisponível'}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="small"
                                                variant="ghost"
                                                onClick={() => {
                                                    setEditVariantAmountMinor(variant.amountAdjustmentMinor);
                                                    setEditingVariantId(variant.id);
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="ghost"
                                                className="text-origin-700"
                                                onClick={() => deleteVariant(variant.id)}
                                                loading={busy === `delete-variant:${variant.id}`}
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    </section>

                    <section className="mt-10">
                        <ProductMediaManager productId={product.id} media={product.media} onChanged={load} />
                    </section>
                </>
            )}
        </main>
    );
}
