'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Globe, Plus, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { api, ApiError } from '@/services/api';
import { MARKETPLACE_NAMES, type AdminCategory, type AdminProduct } from '@/types/api';
import { ProductMediaManager } from '../ProductMediaManager';
import type { VariantDraft } from './NewProductPage.types';

const fieldClass =
    'min-h-12 w-full rounded-md border border-line bg-surface px-4 py-3 text-base text-ink shadow-sm transition hover:border-brand-300 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 focus:outline-none dark:border-night-line dark:bg-night-surface dark:text-night-text dark:focus:border-night-accent/70 dark:focus:ring-brand-900/50';

type SourceType = 'MARKETPLACE' | 'MAOMAOBUY';

const SOURCE_TYPE_OPTIONS: Array<{
    value: SourceType;
    title: string;
    description: string;
    icon: typeof Store;
}> = [
    {
        value: 'MARKETPLACE',
        title: 'Marketplace',
        description: 'Comprado sob encomenda em Taobao, Xianyu ou Alibaba — precisa do link do anúncio de origem.',
        icon: Globe,
    },
    {
        value: 'MAOMAOBUY',
        title: 'MaoMaoBuy',
        description: 'Estoque próprio, vendido direto pela MaoMaoBuy — sem link de origem nem conversão de moeda.',
        icon: Store,
    },
];

const STEPS = [
    { key: 'info' as const, label: 'Informações' },
    { key: 'media' as const, label: 'Mídia' },
];

function newVariant(): VariantDraft {
    return { key: crypto.randomUUID(), externalId: '', label: '', amountAdjustmentMinor: '0', isAvailable: true };
}

export function NewProductPage() {
    const router = useRouter();
    const [step, setStep] = useState<'info' | 'media'>('info');
    const [sourceType, setSourceType] = useState<SourceType>('MARKETPLACE');
    const [categories, setCategories] = useState<AdminCategory[]>([]);
    const [variants, setVariants] = useState<VariantDraft[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
    const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<Set<string>>(new Set());
    const [sourceAmountMinor, setSourceAmountMinor] = useState('0');
    const [estimatedShippingAmountMinor, setEstimatedShippingAmountMinor] = useState('0');
    const [stock, setStock] = useState('0');
    const [publishOnFinish, setPublishOnFinish] = useState(false);
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

    function updateVariant(key: string, patch: Partial<VariantDraft>) {
        setVariants((current) => current.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)));
    }

    function removeVariant(key: string) {
        setVariants((current) => current.filter((variant) => variant.key !== key));
    }

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

    function reloadProduct() {
        if (!product) return;
        api<AdminProduct>(`/products/${product.id}`)
            .then(setProduct)
            .catch(() => setError('Não foi possível atualizar a lista de mídia.'));
    }

    async function handleCreateDraft(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (sourceAmountMinor === '0') {
            setError('Informe um preço maior que zero.');
            return;
        }
        setSubmitting(true);
        setError(undefined);
        try {
            const created = await api<AdminProduct>('/products', {
                method: 'POST',
                body: JSON.stringify({
                    slug: String(data.get('slug')),
                    name: String(data.get('name')),
                    description: String(data.get('description')),
                    marketplace: sourceType === 'MAOMAOBUY' ? 'MAOMAOBUY' : String(data.get('marketplace')),
                    marketplaceUrl: sourceType === 'MAOMAOBUY' ? undefined : String(data.get('marketplaceUrl')),
                    sourceCurrency: sourceType === 'MAOMAOBUY' ? 'BRL' : String(data.get('sourceCurrency')),
                    sourceAmountMinor,
                    estimatedShippingAmountMinor:
                        estimatedShippingAmountMinor !== '0' ? estimatedShippingAmountMinor : undefined,
                    stock: Number(stock),
                    isPublished: false,
                    variants:
                        variants.length > 0
                            ? variants.map((variant) => ({
                                  externalId: variant.externalId,
                                  label: variant.label,
                                  amountAdjustmentMinor: variant.amountAdjustmentMinor,
                                  isAvailable: variant.isAvailable,
                              }))
                            : undefined,
                    categoryIds: selectedCategoryIds.size > 0 ? Array.from(selectedCategoryIds) : undefined,
                    subcategoryIds: selectedSubcategoryIds.size > 0 ? Array.from(selectedSubcategoryIds) : undefined,
                }),
            });
            setProduct(created);
            setStep('media');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível criar o produto.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleFinish() {
        if (!product) return;
        setFinishing(true);
        setError(undefined);
        try {
            if (publishOnFinish) {
                await api(`/products/${product.id}`, { method: 'PATCH', body: JSON.stringify({ isPublished: true }) });
            }
            router.replace(`/admin/produtos/${product.id}`);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível publicar o produto.');
            setFinishing(false);
        }
    }

    return (
        <main>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-muted dark:text-night-muted" href="/admin/produtos">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar para produtos
            </Link>

            <p className="mm-kicker mt-5 mb-3">Catálogo</p>
            <h1 className="m-0 text-3xl tracking-[-.03em]">Novo produto</h1>

            <ol className="mt-6 flex flex-wrap items-center gap-3">
                {STEPS.map((item, index) => {
                    const isCurrent = step === item.key;
                    const isDone = item.key === 'info' && step === 'media';
                    return (
                        <li className="flex items-center gap-3" key={item.key}>
                            <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                                    isDone
                                        ? 'border-jade-500 bg-jade-500 text-white'
                                        : isCurrent
                                          ? 'border-primary bg-primary text-white'
                                          : 'border-line text-muted dark:border-night-line dark:text-night-muted'
                                }`}
                            >
                                {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                            </span>
                            <span
                                className={`text-sm font-semibold ${isCurrent ? 'text-ink dark:text-night-text' : 'text-muted dark:text-night-muted'}`}
                            >
                                {item.label}
                            </span>
                            {index < STEPS.length - 1 && <span className="h-px w-8 bg-line dark:bg-night-line" aria-hidden="true" />}
                        </li>
                    );
                })}
            </ol>
            <p className="mt-2 text-sm text-muted dark:text-night-muted">
                {step === 'info' ? 'Preencha os dados do produto para criar o rascunho.' : 'Envie ao menos uma imagem antes de concluir.'}
            </p>

            {step === 'info' && (
                <form className="mt-8 grid max-w-3xl gap-8" onSubmit={handleCreateDraft}>
                    <fieldset className="grid gap-3">
                        <legend className="mb-1 text-lg font-bold">Tipo de produto</legend>
                        <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
                            {SOURCE_TYPE_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const selected = sourceType === option.value;
                                return (
                                    <label
                                        className={`mm-panel-soft flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition ${
                                            selected
                                                ? 'border-primary bg-brand-50 dark:bg-night-brand'
                                                : 'hover:border-brand-300'
                                        }`}
                                        key={option.value}
                                    >
                                        <input
                                            type="radio"
                                            name="sourceType"
                                            className="sr-only"
                                            checked={selected}
                                            onChange={() => setSourceType(option.value)}
                                        />
                                        <span className="flex items-center gap-2 text-sm font-bold">
                                            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                            {option.title}
                                        </span>
                                        <span className="text-xs text-muted dark:text-night-muted">{option.description}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    <section className="grid gap-4">
                        <h2 className="m-0 text-lg">Informações básicas</h2>
                        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                            <Input name="name" label="Nome" placeholder="Ex.: Camiseta MaoMao" required minLength={1} maxLength={300} />
                            <Input
                                name="slug"
                                label="Slug"
                                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                placeholder="camiseta-maomao"
                                hint="Usado na URL pública, ex.: camiseta-maomao."
                                required
                            />
                        </div>
                        <label className="grid gap-2 text-sm font-semibold">
                            Descrição
                            <textarea
                                className={`${fieldClass} min-h-32`}
                                name="description"
                                placeholder="Descreva o produto para o cliente"
                                required
                                minLength={1}
                                maxLength={20000}
                            />
                        </label>
                    </section>

                    <section className="grid gap-4">
                        <div>
                            <h2 className="m-0 text-lg">{sourceType === 'MAOMAOBUY' ? 'Preço' : 'Origem e preço'}</h2>
                            <p className="mt-1 text-sm text-muted dark:text-night-muted">
                                {sourceType === 'MAOMAOBUY'
                                    ? 'Sem link de origem — preço final já em reais, cobrado do cliente sem conversão.'
                                    : 'Dados do anúncio comprado sob encomenda no marketplace de origem.'}
                            </p>
                        </div>

                        {sourceType === 'MARKETPLACE' ? (
                            <>
                                <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                                    <label className="grid gap-2 text-sm font-semibold">
                                        Marketplace de origem
                                        <select className={fieldClass} name="marketplace" required defaultValue={MARKETPLACE_NAMES[0]}>
                                            {MARKETPLACE_NAMES.map((name) => (
                                                <option key={name} value={name}>
                                                    {name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <Input
                                        name="marketplaceUrl"
                                        label="URL do produto de origem"
                                        type="url"
                                        placeholder="https://item.taobao.com/item.htm?id=123"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                                    <label className="grid gap-2 text-sm font-semibold">
                                        Moeda de origem
                                        <select className={fieldClass} name="sourceCurrency" required defaultValue="CNY">
                                            <option value="CNY">CNY</option>
                                            <option value="BRL">BRL</option>
                                        </select>
                                    </label>
                                    <label className="grid gap-2 text-sm font-semibold">
                                        Preço base (na moeda de origem)
                                        <CurrencyInput
                                            className={fieldClass}
                                            minor={sourceAmountMinor}
                                            onMinorChange={setSourceAmountMinor}
                                            required
                                        />
                                    </label>
                                </div>
                            </>
                        ) : (
                            <label className="grid max-w-[calc(50%-0.5rem)] gap-2 text-sm font-semibold max-[600px]:max-w-full">
                                Preço de venda (BRL)
                                <CurrencyInput className={fieldClass} minor={sourceAmountMinor} onMinorChange={setSourceAmountMinor} required />
                            </label>
                        )}
                    </section>

                    <section className="grid gap-4">
                        <h2 className="m-0 text-lg">Frete e estoque</h2>
                        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                            <label className="grid gap-2 text-sm font-semibold">
                                Frete estimado (BRL, opcional)
                                <CurrencyInput
                                    className={fieldClass}
                                    minor={estimatedShippingAmountMinor}
                                    onMinorChange={setEstimatedShippingAmountMinor}
                                />
                                <span className="font-normal text-muted dark:text-night-muted">
                                    Só informativo — mostrado ao cliente na página do produto, não é cobrado com o pedido.
                                </span>
                            </label>
                            <Input
                                label="Estoque"
                                type="number"
                                min={0}
                                step={1}
                                value={stock}
                                onChange={(event) => setStock(event.target.value)}
                                placeholder="0"
                                hint="Unidades disponíveis. Só é debitado quando o pedido é aprovado e liberado para pagamento."
                                required
                            />
                        </div>
                    </section>

                    <label className="flex items-center gap-3 text-sm font-semibold">
                        <input type="checkbox" className="h-4 w-4" checked={publishOnFinish} onChange={(event) => setPublishOnFinish(event.target.checked)} />
                        Publicar ao concluir
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

                    <section>
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="m-0 text-lg">Variantes (opcional)</h2>
                                <p className="mt-1 text-sm text-muted dark:text-night-muted">
                                    Só use se o produto tiver opções como tamanho ou cor. Sem variantes, o produto é vendido como item único.
                                </p>
                            </div>
                            <Button type="button" size="small" variant="ghost" onClick={() => setVariants((current) => [...current, newVariant()])}>
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Adicionar variante
                            </Button>
                        </div>

                        <div className="mt-4 grid gap-4">
                            {variants.map((variant) => (
                                <div className="mm-panel-soft grid grid-cols-[1fr_1fr_120px_auto_auto] items-end gap-3 p-4 max-[700px]:grid-cols-1" key={variant.key}>
                                    <label className="grid gap-1 text-xs font-semibold">
                                        ID externo
                                        <input
                                            className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            value={variant.externalId}
                                            onChange={(event) => updateVariant(variant.key, { externalId: event.target.value })}
                                            placeholder="Ex.: P-42-azul"
                                            required
                                        />
                                    </label>
                                    <label className="grid gap-1 text-xs font-semibold">
                                        Rótulo
                                        <input
                                            className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            value={variant.label}
                                            onChange={(event) => updateVariant(variant.key, { label: event.target.value })}
                                            placeholder="Ex.: Azul, tamanho 42"
                                            required
                                        />
                                    </label>
                                    <label className="grid gap-1 text-xs font-semibold">
                                        Ajuste de preço
                                        <CurrencyInput
                                            className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            minor={variant.amountAdjustmentMinor}
                                            onMinorChange={(minor) => updateVariant(variant.key, { amountAdjustmentMinor: minor })}
                                        />
                                    </label>
                                    <label className="flex h-10 items-center gap-2 text-xs font-semibold">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={variant.isAvailable}
                                            onChange={(event) => updateVariant(variant.key, { isAvailable: event.target.checked })}
                                        />
                                        Disponível
                                    </label>
                                    <Button type="button" size="small" variant="ghost" className="text-origin-700" onClick={() => removeVariant(variant.key)}>
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {error && <p className="border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}

                    <Button type="submit" loading={submitting}>
                        {submitting ? 'Criando…' : 'Continuar para mídia'}
                    </Button>
                </form>
            )}

            {step === 'media' && product && (
                <div className="mt-8 grid max-w-3xl gap-6">
                    <p className="text-sm text-muted dark:text-night-muted">
                        Produto <strong>{product.name}</strong> criado como rascunho. Envie ao menos uma imagem antes de concluir.
                    </p>

                    <ProductMediaManager productId={product.id} media={product.media} onChanged={reloadProduct} />

                    {error && <p className="border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}

                    <div className="flex gap-3">
                        <Button type="button" onClick={handleFinish} loading={finishing} disabled={product.media.length === 0}>
                            {finishing ? 'Concluindo…' : 'Concluir'}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => router.replace(`/admin/produtos/${product.id}`)}>
                            Concluir depois
                        </Button>
                    </div>
                </div>
            )}
        </main>
    );
}
