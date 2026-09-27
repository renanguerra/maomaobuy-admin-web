'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PackageSearch, Trash2 } from 'lucide-react';
import { ActionDialog } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SummaryList } from '@/components/admin/SummaryList';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { ApiError, api } from '@/services/api';
import {
    cny,
    type AdminOrder,
    type AdminOrderPreview,
    type AdminProduct,
    type AdminUser,
    type Page,
} from '@/types/api';

/** O mesmo teto por linha do carrinho e do backend. */
const MAX_QUANTITY = 999;

type Customer = Pick<AdminUser, 'id' | 'name' | 'email'>;

interface Line {
    product: AdminProduct;
    variantExternalId: string;
    quantity: number;
}

const lineKey = (productId: string, variantExternalId: string) => `${productId}:${variantExternalId}`;

/** Produto que a vitrine não vende (Coin Shop, adicional do checkout) não entra no pedido. */
const isForSale = (product: AdminProduct) => !product.isCoinExclusive && !product.isCheckoutAddon;

/**
 * Pedido montado pela equipe: o admin escolhe o cliente e os produtos da
 * loja, confere o total que o backend calcula (mesma taxa do carrinho) e
 * confirma com o TOTP. O cliente recebe o e-mail para aceitar e pagar.
 *
 * `?usuario=<id>` já abre com o cliente escolhido — é o link do detalhe do
 * usuário.
 */
export function CreateOrderPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const presetUserId = searchParams.get('usuario');

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [customerError, setCustomerError] = useState<string>();
    const [lines, setLines] = useState<Line[]>([]);
    const [note, setNote] = useState('');
    const [preview, setPreview] = useState<{ key: string; data?: AdminOrderPreview; error?: string }>();
    const [confirming, setConfirming] = useState(false);
    // Uma chave por formulário aberto: um segundo clique (ou a rede repetindo
    // o envio) devolve o mesmo pedido em vez de criar outro.
    const [idempotencyKey] = useState(() => crypto.randomUUID());

    useEffect(() => {
        if (!presetUserId) return;
        let active = true;
        api<AdminUser>(`/users/${presetUserId}`)
            .then((user) => {
                if (active) setCustomer({ id: user.id, name: user.name, email: user.email });
            })
            .catch(() => {
                if (active) setCustomerError(t('orders.create.userLoadError'));
            });
        return () => {
            active = false;
        };
    }, [presetUserId, t]);

    const items = lines.map((line) => ({
        productId: line.product.id,
        variantExternalId: line.variantExternalId || undefined,
        quantity: line.quantity,
    }));
    const previewKey = customer && items.length > 0 ? JSON.stringify({ userId: customer.id, items }) : null;

    // A prévia vem do backend — preço, variação, estoque e taxa são os dele.
    // Pausa curta para não disparar uma consulta a cada tecla na quantidade.
    useEffect(() => {
        if (!previewKey) return;
        let active = true;
        const timer = setTimeout(() => {
            api<AdminOrderPreview>('/orders/for-user/preview', { method: 'POST', body: previewKey })
                .then((data) => {
                    if (active) setPreview({ key: previewKey, data });
                })
                .catch((err) => {
                    if (active)
                        setPreview({
                            key: previewKey,
                            error: err instanceof ApiError ? err.message : t('orders.create.previewError'),
                        });
                });
        }, 300);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [previewKey, t]);

    const current = preview && preview.key === previewKey ? preview : undefined;
    const problems = new Map(
        (current?.data?.lines ?? [])
            .filter((line) => line.problem)
            .map((line) => [lineKey(line.productId, line.variantExternalId), line.problem as string]),
    );
    const canSubmit = Boolean(current?.data) && problems.size === 0 && lines.length > 0;

    function addLine(product: AdminProduct, variantExternalId: string) {
        setLines((existing) => {
            const key = lineKey(product.id, variantExternalId);
            const found = existing.find((line) => lineKey(line.product.id, line.variantExternalId) === key);
            if (found)
                return existing.map((line) =>
                    line === found ? { ...line, quantity: Math.min(line.quantity + 1, MAX_QUANTITY) } : line,
                );
            return [...existing, { product, variantExternalId, quantity: 1 }];
        });
    }

    async function create({ totpCode, reason }: { totpCode: string; reason: string }) {
        if (!customer) return;
        const orders = await api<AdminOrder[]>('/orders/for-user', {
            method: 'POST',
            body: JSON.stringify({
                userId: customer.id,
                items,
                note: note.trim() || undefined,
                idempotencyKey,
                totpCode,
                reason: reason.trim() || undefined,
            }),
        });
        notify({
            tone: 'success',
            title:
                orders.length > 1
                    ? t('orders.create.createdToastMany', { count: String(orders.length) })
                    : t('orders.create.createdToast'),
        });
        router.push(`/admin/pedidos/${orders[0].id}`);
    }

    return (
        <div className="grid gap-6">
            <PageHeader
                backHref="/admin/pedidos"
                backLabel={t('orders.detail.backLink')}
                description={t('orders.create.description')}
                kicker={t('orders.create.kicker')}
                title={t('orders.create.title')}
            />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid min-w-0 gap-6">
                    <SectionCard title={t('orders.create.customerTitle')}>
                        {customerError && (
                            <Alert className="mb-3" tone="danger">
                                <p>{customerError}</p>
                            </Alert>
                        )}
                        <CustomerPicker onChange={setCustomer} value={customer} />
                    </SectionCard>

                    <SectionCard title={t('orders.create.productsTitle')}>
                        <ProductPicker onAdd={addLine} />

                        <div className="mt-5 border-t border-line pt-4 dark:border-night-line">
                            {lines.length === 0 ? (
                                <EmptyState
                                    description={t('orders.create.emptyItemsHint')}
                                    icon={PackageSearch}
                                    title={t('orders.create.emptyItems')}
                                />
                            ) : (
                                <ul className="m-0 grid list-none gap-0 divide-y divide-line p-0 dark:divide-night-line">
                                    {lines.map((line, index) => (
                                        <SelectedLine
                                            key={lineKey(line.product.id, line.variantExternalId)}
                                            line={line}
                                            onQuantityChange={(quantity) =>
                                                setLines((existing) =>
                                                    existing.map((entry, position) =>
                                                        position === index ? { ...entry, quantity } : entry,
                                                    ),
                                                )
                                            }
                                            onRemove={() =>
                                                setLines((existing) =>
                                                    existing.filter((_, position) => position !== index),
                                                )
                                            }
                                            problem={problems.get(lineKey(line.product.id, line.variantExternalId))}
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title={t('orders.create.noteTitle')}>
                        <Textarea
                            hint={t('orders.create.noteHint')}
                            label={t('orders.create.noteLabel')}
                            maxLength={2000}
                            onChange={(event) => setNote(event.target.value)}
                            value={note}
                        />
                    </SectionCard>
                </div>

                <aside className="grid gap-4 xl:sticky xl:top-6">
                    <SectionCard title={t('orders.create.summaryTitle')}>
                        <PreviewSummary
                            error={current?.error}
                            loading={Boolean(previewKey) && !current}
                            preview={previewKey ? current?.data : undefined}
                        />
                        {problems.size > 0 && (
                            <Alert className="mt-4" tone="warning">
                                <p>{t('orders.create.fixProblems')}</p>
                            </Alert>
                        )}
                        <Button className="mt-5" disabled={!canSubmit} fullWidth onClick={() => setConfirming(true)}>
                            {t('orders.create.submit')}
                        </Button>
                    </SectionCard>
                </aside>
            </div>

            <ActionDialog
                confirmLabel={t('orders.create.confirmButton')}
                description={t('orders.create.confirmDescription')}
                onCancel={() => setConfirming(false)}
                onConfirm={create}
                open={confirming && Boolean(customer)}
                title={t('orders.create.confirmTitle', { name: customer?.name ?? '' })}
            />
        </div>
    );
}

/** Mesma busca da lista de usuários (nome, usuário ou e-mail). */
function CustomerPicker({
    value,
    onChange,
}: {
    value: Customer | null;
    onChange: (customer: Customer | null) => void;
}) {
    const { t } = useTranslation();
    const [term, setTerm] = useState('');
    const [found, setFound] = useState<{ term: string; users: AdminUser[] }>();
    const searching = term.trim().length >= 2;
    const results = found?.term === term.trim() ? found.users : undefined;

    useEffect(() => {
        if (!searching) return;
        let active = true;
        const current = term.trim();
        const query = new URLSearchParams({ search: current, limit: '8' });
        api<Page<AdminUser>>(`/users?${query.toString()}`)
            .then((page) => {
                if (active) setFound({ term: current, users: page.data });
            })
            .catch(() => {
                if (active) setFound({ term: current, users: [] });
            });
        return () => {
            active = false;
        };
    }, [term, searching]);

    if (value)
        return (
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0">
                    <span className="block text-xs text-muted dark:text-night-muted">
                        {t('orders.create.userSelected')}
                    </span>
                    <span className="block truncate font-semibold text-ink dark:text-night-text">{value.name}</span>
                    <span className="block truncate text-sm text-muted dark:text-night-muted">{value.email}</span>
                </span>
                <Button onClick={() => onChange(null)} size="small" type="button" variant="secondary">
                    {t('orders.create.userChange')}
                </Button>
            </div>
        );

    return (
        <div className="grid gap-2">
            <SearchInput
                clearLabel={t('common.actions.clearSearch')}
                delay={250}
                label={t('orders.create.userSearch')}
                onChange={setTerm}
                placeholder={t('orders.create.userSearchPlaceholder')}
                value={term}
            />
            {searching && (
                <ul className="m-0 grid max-h-64 list-none gap-1 overflow-y-auto p-0">
                    {results === undefined ? (
                        <li className="px-2 py-1.5 text-sm text-muted dark:text-night-muted">
                            {t('orders.create.userSearching')}
                        </li>
                    ) : results.length === 0 ? (
                        <li className="px-2 py-1.5 text-sm text-muted dark:text-night-muted">
                            {t('orders.create.userNone')}
                        </li>
                    ) : (
                        results.map((user) => (
                            <li key={user.id}>
                                <button
                                    className="flex w-full flex-col rounded-md px-2 py-1.5 text-left transition hover:bg-brand-50 dark:hover:bg-night-brand-hover"
                                    onClick={() => onChange({ id: user.id, name: user.name, email: user.email })}
                                    type="button"
                                >
                                    <span className="text-sm font-semibold text-ink dark:text-night-text">
                                        {user.name}
                                    </span>
                                    <span className="text-xs text-muted dark:text-night-muted">{user.email}</span>
                                </button>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}

/** Busca na loja por nome ou slug; só produtos publicados. */
function ProductPicker({ onAdd }: { onAdd: (product: AdminProduct, variantExternalId: string) => void }) {
    const { t } = useTranslation();
    const [term, setTerm] = useState('');
    const [found, setFound] = useState<{ term: string; products: AdminProduct[] }>();
    const searching = term.trim().length >= 2;
    const results = found?.term === term.trim() ? found.products : undefined;

    useEffect(() => {
        if (!searching) return;
        let active = true;
        const current = term.trim();
        const query = new URLSearchParams({ search: current, status: 'published', limit: '8' });
        api<Page<AdminProduct>>(`/products?${query.toString()}`)
            .then((page) => {
                if (active) setFound({ term: current, products: page.data });
            })
            .catch(() => {
                if (active) setFound({ term: current, products: [] });
            });
        return () => {
            active = false;
        };
    }, [term, searching]);

    return (
        <div className="grid gap-2">
            <SearchInput
                clearLabel={t('common.actions.clearSearch')}
                delay={250}
                label={t('orders.create.productSearch')}
                onChange={setTerm}
                placeholder={t('orders.create.productSearchPlaceholder')}
                value={term}
            />
            {searching && (
                <ul className="m-0 grid list-none gap-0 divide-y divide-line p-0 dark:divide-night-line">
                    {results === undefined ? (
                        <li className="py-2 text-sm text-muted dark:text-night-muted">
                            {t('orders.create.productSearching')}
                        </li>
                    ) : results.length === 0 ? (
                        <li className="py-2 text-sm text-muted dark:text-night-muted">
                            {t('orders.create.productNone')}
                        </li>
                    ) : (
                        results.map((product) => <ProductResult key={product.id} onAdd={onAdd} product={product} />)
                    )}
                </ul>
            )}
        </div>
    );
}

function ProductResult({
    product,
    onAdd,
}: {
    product: AdminProduct;
    onAdd: (product: AdminProduct, variantExternalId: string) => void;
}) {
    const { t } = useTranslation();
    const variants = product.variants.filter((variant) => variant.isAvailable);
    const [variantExternalId, setVariantExternalId] = useState(variants[0]?.externalId ?? '');
    const thumbnail = product.media.find((media) => media.type === 'IMAGE' && media.url)?.url;
    const soldOut = !product.isOnDemand && product.stock <= 0;
    const blocked = !isForSale(product) || soldOut || (product.variants.length > 0 && variants.length === 0);

    const availability = !isForSale(product)
        ? t('orders.create.notForSale')
        : product.isOnDemand
          ? t('orders.create.onDemand')
          : soldOut
            ? t('orders.create.outOfStock')
            : t('orders.create.stock', { count: String(product.stock) });

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL assinada do bucket, sem otimização
                <img
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-md border border-line object-cover dark:border-night-line"
                    src={thumbnail}
                />
            ) : (
                <span
                    aria-hidden="true"
                    className="h-11 w-11 shrink-0 rounded-md border border-line bg-warm-100 dark:border-night-line dark:bg-night-raised"
                />
            )}
            <span className="min-w-48 flex-1">
                <span className="line-clamp-2 text-sm font-semibold text-ink dark:text-night-text">{product.name}</span>
                <span className="mm-data block text-xs text-muted dark:text-night-muted">
                    {cny(product.sourceAmountMinor)} · {availability}
                    {product.isPreSale && ` · ${t('orders.create.preSale')}`}
                </span>
            </span>
            {/* Variação e botão andam juntos: numa coluna estreita os dois
                descem para a linha de baixo, nunca só o botão. */}
            <div className="ml-auto flex items-center gap-2">
                {variants.length > 0 && (
                    <Select
                        fieldClassName="w-40"
                        hideLabel
                        label={t('orders.create.variantLabel', { name: product.name })}
                        onChange={(event) => setVariantExternalId(event.target.value)}
                        options={variants.map((variant) => ({ value: variant.externalId, label: variant.label }))}
                        value={variantExternalId}
                    />
                )}
                <Button
                    disabled={blocked}
                    onClick={() => onAdd(product, variantExternalId)}
                    size="small"
                    type="button"
                    variant="secondary"
                >
                    {t('orders.create.add')}
                </Button>
            </div>
        </li>
    );
}

function SelectedLine({
    line,
    problem,
    onQuantityChange,
    onRemove,
}: {
    line: Line;
    problem: string | undefined;
    onQuantityChange: (quantity: number) => void;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    const variant = line.product.variants.find((entry) => entry.externalId === line.variantExternalId);
    const unitMinor = BigInt(line.product.sourceAmountMinor) + BigInt(variant?.amountAdjustmentMinor ?? '0');
    const name = variant ? `${line.product.name} — ${variant.label}` : line.product.name;

    return (
        <li className="grid gap-1.5 py-3 first:pt-0">
            <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink dark:text-night-text">{name}</span>
                    <span className="mm-data block text-xs text-muted dark:text-night-muted">
                        {t('orders.create.unitPrice', { price: cny(unitMinor.toString()) })}
                    </span>
                </span>
                <Input
                    className="text-right"
                    fieldClassName="w-24"
                    hideLabel
                    inputMode="numeric"
                    label={t('orders.create.quantityLabel', { name })}
                    max={MAX_QUANTITY}
                    min={1}
                    onChange={(event) => {
                        const value = Math.trunc(Number(event.target.value));
                        onQuantityChange(Math.min(Math.max(Number.isFinite(value) ? value : 1, 1), MAX_QUANTITY));
                    }}
                    type="number"
                    value={line.quantity}
                />
                <Button
                    aria-label={t('orders.create.remove', { name })}
                    iconOnly
                    leadingIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    onClick={onRemove}
                    size="small"
                    type="button"
                    variant="dangerGhost"
                />
            </div>
            {problem && <p className="m-0 text-xs font-semibold text-origin-700 dark:text-night-coral">{problem}</p>}
        </li>
    );
}

function PreviewSummary({
    preview,
    loading,
    error,
}: {
    preview: AdminOrderPreview | undefined;
    loading: boolean;
    error: string | undefined;
}) {
    const { t } = useTranslation();

    if (error)
        return (
            <Alert tone="danger">
                <p>{error}</p>
            </Alert>
        );
    if (loading)
        return <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.create.summaryLoading')}</p>;
    if (!preview || preview.groups.length === 0)
        return <p className="m-0 text-sm text-muted dark:text-night-muted">{t('orders.create.summaryEmpty')}</p>;

    return (
        <div className="grid gap-5">
            {preview.groups.map((group) => (
                <div key={group.fulfillmentMode}>
                    {preview.groups.length > 1 && (
                        <p className="m-0 mb-2 text-sm font-semibold text-ink dark:text-night-text">
                            {group.fulfillmentMode === 'IN_STOCK'
                                ? t('orders.create.groupInStock')
                                : t('orders.create.groupSourced')}
                        </p>
                    )}
                    <SummaryList
                        rows={[
                            { label: t('orders.create.products'), value: cny(group.productAmountMinor) },
                            ...(group.serviceFeeMinor !== '0'
                                ? [{ label: t('orders.create.serviceFee'), value: cny(group.serviceFeeMinor) }]
                                : []),
                            { label: t('orders.create.total'), value: cny(group.totalAmountMinor), emphasis: true },
                            ...(group.shippingEstimateAmountMinor
                                ? [
                                      {
                                          label: t('orders.create.shipping'),
                                          value: cny(group.shippingEstimateAmountMinor),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                </div>
            ))}
            {preview.groups.length > 1 && (
                <p className="m-0 text-xs leading-relaxed text-muted dark:text-night-muted">
                    {t('orders.create.splitHint')}
                </p>
            )}
        </div>
    );
}
