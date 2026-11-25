'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, ImageOff, Package, Trash2 } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DescriptionList } from '@/components/admin/DescriptionList';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny, type AdminBox, type AdminProduct, type Page } from '@/types/api';
import { slugify } from '../../categorias/slugify';
import { productPath } from '../product-kind';
import { boxSummary, cannotEnterBox, draftOptions, lineKey, type BoxDraftLine } from './box-draft';

interface BoxContentsManagerProps {
    product: AdminProduct;
    /** O estoque e o custo da box mudam aqui: a tela relê o produto. */
    onChanged: () => void;
}

const percent = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/**
 * O conteúdo da box promocional e a montagem: escolher os produtos, ver soma,
 * desconto e lucro na hora, montar (tira dos produtos) e desmontar (devolve).
 * Com unidade montada o conteúdo trava.
 */
export function BoxContentsManager({ product, onChanged }: BoxContentsManagerProps) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const confirm = useConfirm();
    const [box, setBox] = useState<AdminBox>();
    const [loadFailed, setLoadFailed] = useState(false);
    const [draft, setDraft] = useState<BoxDraftLine[]>();
    const [quantity, setQuantity] = useState('1');
    const [busy, setBusy] = useState<'save' | 'build' | 'dismantle'>();
    const [duplicating, setDuplicating] = useState(false);

    useEffect(() => {
        let active = true;
        api<AdminBox>(`/products/${product.id}/box`)
            .then((loaded) => {
                if (active) setBox(loaded);
            })
            .catch(() => {
                if (active) setLoadFailed(true);
            });
        return () => {
            active = false;
        };
    }, [product.id]);

    const reportError = useCallback(
        (err: unknown) =>
            notify({
                tone: 'danger',
                title: t('common.errors.actionTitle'),
                description: err instanceof ApiError ? err.message : t('common.errors.generic'),
            }),
        [notify, t],
    );

    if (loadFailed)
        return (
            <Alert tone="danger" title={t('common.errors.loadTitle')}>
                <p>{t('products.box.loadError')}</p>
            </Alert>
        );
    if (!box) return <SkeletonCards label={t('products.box.loading')} />;

    const lines: BoxDraftLine[] = draft ?? box.items;
    const summary = boxSummary(lines, product.sourceAmountMinor);
    const units = Number(quantity);
    const validUnits = Number.isInteger(units) && units > 0;

    async function run(action: 'save' | 'build' | 'dismantle', request: () => Promise<AdminBox>, message: string) {
        setBusy(action);
        try {
            setBox(await request());
            setDraft(undefined);
            notify({ tone: 'success', title: message });
            onChanged();
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    const save = () =>
        run(
            'save',
            () =>
                api<AdminBox>(`/products/${product.id}/box/items`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        items: lines.map((line) => ({
                            productId: line.productId,
                            variantExternalId: line.variantExternalId || undefined,
                            quantity: line.quantity,
                            isGift: line.isGift,
                        })),
                    }),
                }),
            t('products.box.savedToast'),
        );

    async function move(action: 'build' | 'dismantle') {
        const confirmed = await confirm({
            title: t(`products.box.${action}Title`, { count: units }),
            description: t(`products.box.${action}Confirm`),
            confirmLabel: t(`products.box.${action}`),
        });
        if (!confirmed) return;
        await run(
            action,
            () =>
                api<AdminBox>(`/products/${product.id}/box/${action}`, {
                    method: 'POST',
                    body: JSON.stringify({ quantity: units, expectedUnitsTotal: box!.unitsTotal }),
                }),
            t(`products.box.${action}Toast`, { count: units }),
        );
    }

    const update = (key: string, change: Partial<BoxDraftLine>) =>
        setDraft(lines.map((line) => (lineKey(line) === key ? { ...line, ...change } : line)));

    return (
        <>
            <SectionCard
                flush
                title={t('products.box.contentsTitle')}
                description={box.locked ? t('products.box.lockedDescription') : t('products.box.contentsDescription')}
                action={
                    <Button
                        leadingIcon={<Copy className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => setDuplicating(true)}
                        size="small"
                        variant="secondary"
                    >
                        {t('products.box.duplicate')}
                    </Button>
                }
            >
                {!box.locked && (
                    <div className="border-b border-line px-5 py-4 dark:border-night-line">
                        <BoxProductSearch
                            taken={new Set(lines.map(lineKey))}
                            onPick={(line) => setDraft([...lines, line])}
                        />
                    </div>
                )}
                {lines.length === 0 ? (
                    <EmptyState
                        description={t('products.box.emptyDescription')}
                        icon={Package}
                        title={t('products.box.empty')}
                    />
                ) : (
                    <ListRows>
                        {lines.map((line) => {
                            const key = lineKey(line);
                            const problem = box.items.find((item) => lineKey(item) === key)?.problem;
                            return (
                                <li key={key}>
                                    <ListRow
                                        title={line.name}
                                        leading={<Thumb url={line.thumbnailUrl} />}
                                        meta={
                                            <>
                                                {[
                                                    line.variantLabel,
                                                    line.unitAmountMinor === null
                                                        ? t('products.box.notSoldAlone')
                                                        : t('products.box.unitPrice', {
                                                              amount: cny(line.unitAmountMinor),
                                                          }),
                                                    t('products.box.inStock', { count: line.stock }),
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                                {problem && (
                                                    <span className="mt-0.5 block text-origin-700 dark:text-night-coral">
                                                        {problem}
                                                    </span>
                                                )}
                                            </>
                                        }
                                        pill={
                                            box.locked && line.isGift ? (
                                                <StatusPill tone="info">{t('products.box.gift')}</StatusPill>
                                            ) : undefined
                                        }
                                        value={box.locked ? `× ${line.quantity}` : undefined}
                                        actions={
                                            box.locked ? undefined : (
                                                <>
                                                    <Checkbox
                                                        checked={line.isGift}
                                                        label={t('products.box.gift')}
                                                        onChange={(event) =>
                                                            update(key, { isGift: event.target.checked })
                                                        }
                                                    />
                                                    <Input
                                                        fieldClassName="w-20"
                                                        hideLabel
                                                        label={t('products.box.quantityOf', { name: line.name })}
                                                        max={100}
                                                        min={1}
                                                        onChange={(event) =>
                                                            update(key, {
                                                                quantity: Math.min(
                                                                    100,
                                                                    Math.max(
                                                                        1,
                                                                        Math.floor(Number(event.target.value)) || 1,
                                                                    ),
                                                                ),
                                                            })
                                                        }
                                                        type="number"
                                                        value={String(line.quantity)}
                                                    />
                                                    <Button
                                                        aria-label={t('products.box.removeAria', { name: line.name })}
                                                        iconOnly
                                                        onClick={() =>
                                                            setDraft(lines.filter((other) => lineKey(other) !== key))
                                                        }
                                                        size="small"
                                                        variant="dangerGhost"
                                                    >
                                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                </>
                                            )
                                        }
                                    />
                                </li>
                            );
                        })}
                    </ListRows>
                )}
                {draft && (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 dark:border-night-line">
                        <Button
                            disabled={busy !== undefined}
                            onClick={() => setDraft(undefined)}
                            size="small"
                            variant="ghost"
                        >
                            {t('common.actions.cancel')}
                        </Button>
                        <Button
                            disabled={draft.length === 0}
                            loading={busy === 'save'}
                            onClick={() => void save()}
                            size="small"
                        >
                            {t('products.box.save')}
                        </Button>
                    </div>
                )}
            </SectionCard>

            <SectionCard title={t('products.box.numbersTitle')} description={t('products.box.numbersDescription')}>
                <DescriptionList
                    items={[
                        { label: t('products.box.regular'), value: cny(summary.regularMinor), numeric: true },
                        { label: t('products.box.price'), value: cny(product.sourceAmountMinor), numeric: true },
                        {
                            label: t('products.box.savings'),
                            value:
                                BigInt(summary.savingsMinor) > BigInt(0)
                                    ? `${cny(summary.savingsMinor)} (${percent(summary.savingsPercent)})`
                                    : t('products.box.noSavings'),
                            numeric: true,
                        },
                        {
                            label: t('products.box.cost'),
                            value: summary.costMinor === null ? t('products.box.costMissing') : cny(summary.costMinor),
                            numeric: true,
                        },
                        {
                            label: t('products.box.profit'),
                            value:
                                summary.profitMinor === null
                                    ? t('common.dash')
                                    : `${cny(summary.profitMinor)} (${percent(summary.profitPercent)})`,
                            numeric: true,
                        },
                        {
                            label: t('products.box.contentsWeight'),
                            value:
                                draft || box.items.length === 0
                                    ? t('common.dash')
                                    : box.contentsWeightGrams === null
                                      ? t('products.box.weightMissing')
                                      : `${box.contentsWeightGrams} g`,
                            numeric: true,
                        },
                    ]}
                />
                {summary.profitMinor !== null && BigInt(summary.profitMinor) < BigInt(0) && (
                    <Alert className="mt-4" tone="warning" title={t('products.box.belowCost')} />
                )}
            </SectionCard>

            <SectionCard title={t('products.box.stockTitle')} description={t('products.box.stockDescription')}>
                <DescriptionList
                    items={[
                        { label: t('products.box.available'), value: box.stock, numeric: true },
                        { label: t('products.box.sold'), value: box.sold, numeric: true },
                        {
                            label: t('products.box.buildable'),
                            value: draft ? t('common.dash') : box.buildable,
                            numeric: true,
                        },
                    ]}
                />
                <div className="mt-5 flex flex-wrap items-end gap-3">
                    <Input
                        fieldClassName="w-32"
                        label={t('products.box.units')}
                        min={1}
                        onChange={(event) => setQuantity(event.target.value)}
                        type="number"
                        value={quantity}
                    />
                    <Button
                        disabled={Boolean(draft) || !validUnits || units > box.buildable || busy !== undefined}
                        loading={busy === 'build'}
                        onClick={() => void move('build')}
                    >
                        {t('products.box.build')}
                    </Button>
                    <Button
                        disabled={Boolean(draft) || !validUnits || units > box.stock || busy !== undefined}
                        loading={busy === 'dismantle'}
                        onClick={() => void move('dismantle')}
                        variant="secondary"
                    >
                        {t('products.box.dismantle')}
                    </Button>
                </div>
                {draft && (
                    <p className="mt-3 mb-0 text-xs text-muted dark:text-night-muted">{t('products.box.saveFirst')}</p>
                )}
            </SectionCard>

            {duplicating && (
                <DuplicateBoxDialog onClose={() => setDuplicating(false)} onError={reportError} product={product} />
            )}
        </>
    );
}

function Thumb({ url }: { url: string | null }) {
    return (
        <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-line bg-warm-200 dark:border-night-line dark:bg-night-raised">
            {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-full w-full object-cover" loading="lazy" src={url} />
            ) : (
                <ImageOff className="h-4 w-4 text-muted dark:text-night-subtle" aria-hidden="true" />
            )}
        </span>
    );
}

/** Busca por nome; cada variação disponível é uma opção própria. */
function BoxProductSearch({ taken, onPick }: { taken: ReadonlySet<string>; onPick: (line: BoxDraftLine) => void }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<{ term: string; products: AdminProduct[] }>();
    const term = search.trim();

    useEffect(() => {
        if (term.length < 2) return;
        let active = true;
        const timer = setTimeout(() => {
            const query = new URLSearchParams({ search: term, limit: '12', page: '1' });
            api<Page<AdminProduct>>(`/products?${query.toString()}`)
                .then((page) => {
                    if (active) setResults({ term, products: page.data });
                })
                .catch(() => {
                    if (active) setResults({ term, products: [] });
                });
        }, 250);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [term]);

    const options =
        results?.term === term
            ? results.products
                  .filter((product) => !cannotEnterBox(product))
                  .flatMap(draftOptions)
                  .filter((line) => !taken.has(lineKey(line)))
            : undefined;

    return (
        <div className="grid gap-1">
            <Input
                hint={t('products.box.searchHint')}
                label={t('products.box.search')}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('products.box.searchPlaceholder')}
                value={search}
            />
            {term.length >= 2 && options && (
                <ul className="m-0 grid max-h-72 list-none gap-0.5 overflow-auto rounded-md border border-line p-1 dark:border-night-line">
                    {options.length === 0 && (
                        <li className="px-2 py-1.5 text-xs text-muted dark:text-night-muted">
                            {t('products.box.noResults')}
                        </li>
                    )}
                    {options.map((line) => (
                        <li key={lineKey(line)}>
                            <button
                                className="flex w-full cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-brand-50 dark:hover:bg-night-raised"
                                onClick={() => {
                                    onPick(line);
                                    setSearch('');
                                }}
                                type="button"
                            >
                                <Thumb url={line.thumbnailUrl} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate">{line.name}</span>
                                    <span className="block text-xs text-muted dark:text-night-muted">
                                        {[
                                            line.variantLabel,
                                            line.unitAmountMinor && cny(line.unitAmountMinor),
                                            t('products.box.inStock', { count: line.stock }),
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function DuplicateBoxDialog({
    product,
    onClose,
    onError,
}: {
    product: AdminProduct;
    onClose: () => void;
    onError: (err: unknown) => void;
}) {
    const { t } = useTranslation();
    const router = useRouter();
    const [name, setName] = useState(t('products.box.duplicateName', { name: product.name }));
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        try {
            const created = await api<{ id: string }>(`/products/${product.id}/box/duplicate`, {
                method: 'POST',
                body: JSON.stringify({ name: name.trim(), slug: slugify(name) }),
            });
            router.push(productPath('BOX', created.id));
            onClose();
        } catch (err) {
            onError(err);
            setBusy(false);
        }
    }

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('products.box.duplicateDescription')}
            onClose={onClose}
            open
            title={t('products.box.duplicate')}
            footer={
                <>
                    <Button onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form="duplicate-box" loading={busy} type="submit">
                        {t('products.box.duplicate')}
                    </Button>
                </>
            }
        >
            <form id="duplicate-box" onSubmit={(event) => void submit(event)}>
                <Input
                    label={t('products.new.basicInfo.name')}
                    maxLength={300}
                    onChange={(event) => setName(event.target.value)}
                    required
                    value={name}
                />
            </form>
        </Modal>
    );
}
