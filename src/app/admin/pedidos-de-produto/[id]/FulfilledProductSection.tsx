'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PackageCheck } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { SectionCard } from '@/components/admin/SectionCard';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny, type AdminProduct, type AdminProductRequest, type Page } from '@/types/api';

/** Exclusivo da Coin Shop e "Leve junto" não aparecem na vitrine: não atendem encomenda. */
const isInStore = (product: AdminProduct) => !product.isCoinExclusive && !product.isCheckoutAddon;

/**
 * A encomenda termina num produto da loja: a equipe cadastra (ou já tinha) o
 * produto, escolhe aqui e marca como disponibilizada. O cliente recebe o
 * e-mail com o link desse produto e o vê na própria encomenda.
 */
export function FulfilledProductSection({
    request,
    onUpdated,
}: {
    request: AdminProductRequest;
    onUpdated: (updated: AdminProductRequest) => void;
}) {
    const { t } = useTranslation();
    const [choosing, setChoosing] = useState(!request.fulfilledProduct);
    const [term, setTerm] = useState('');
    const [found, setFound] = useState<{ term: string; products: AdminProduct[] }>();
    const [selected, setSelected] = useState<AdminProduct>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    const searching = term.trim().length >= 2;
    const results = found?.term === term.trim() ? found.products.filter(isInStore) : undefined;

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

    async function confirm() {
        if (!selected) return;
        setBusy(true);
        setError(undefined);
        try {
            const updated = await api<AdminProductRequest>(`/product-requests/${request.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'FULFILLED', productId: selected.id }),
            });
            setSelected(undefined);
            setChoosing(false);
            onUpdated(updated);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('productRequests.actionError'));
        } finally {
            setBusy(false);
        }
    }

    const current = request.fulfilledProduct;

    return (
        <SectionCard
            description={t('productRequests.product.description')}
            icon={<PackageCheck aria-hidden="true" />}
            title={t('productRequests.product.title')}
        >
            {current && !choosing ? (
                <div className="grid gap-3">
                    <p className="m-0 text-sm text-ink dark:text-night-text">
                        <Link
                            className="font-semibold text-primary no-underline hover:underline dark:text-night-accent"
                            href={`/admin/produtos/${current.id}`}
                        >
                            {current.name}
                        </Link>
                        {!current.isPublished && (
                            <span className="text-muted dark:text-night-muted">
                                {' '}
                                · {t('productRequests.product.unpublished')}
                            </span>
                        )}
                    </p>
                    <div>
                        <Button onClick={() => setChoosing(true)} size="small" variant="secondary">
                            {t('productRequests.product.change')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid gap-3">
                    {error && (
                        <Alert tone="danger" title={t('common.errors.loadTitle')}>
                            <p>{error}</p>
                        </Alert>
                    )}
                    <SearchInput
                        clearLabel={t('common.actions.clearSearch')}
                        delay={250}
                        label={t('productRequests.product.searchLabel')}
                        onChange={setTerm}
                        placeholder={t('productRequests.product.searchPlaceholder')}
                        value={term}
                    />
                    {searching && (
                        <ul className="m-0 grid list-none gap-0 divide-y divide-line p-0 dark:divide-night-line">
                            {results === undefined ? (
                                <li className="py-2 text-sm text-muted dark:text-night-muted">
                                    {t('productRequests.product.searching')}
                                </li>
                            ) : results.length === 0 ? (
                                <li className="py-2 text-sm text-muted dark:text-night-muted">
                                    {t('productRequests.product.none')}
                                </li>
                            ) : (
                                results.map((product) => (
                                    <li className="flex items-center gap-3 py-2.5" key={product.id}>
                                        <span className="min-w-0 flex-1">
                                            <span className="line-clamp-2 text-sm font-semibold text-ink dark:text-night-text">
                                                {product.name}
                                            </span>
                                            <span className="mm-data block text-xs text-muted dark:text-night-muted">
                                                {cny(product.sourceAmountMinor)}
                                            </span>
                                        </span>
                                        <Button
                                            onClick={() => setSelected(product)}
                                            size="small"
                                            variant={selected?.id === product.id ? 'primary' : 'secondary'}
                                        >
                                            {selected?.id === product.id
                                                ? t('productRequests.product.selected')
                                                : t('productRequests.product.select')}
                                        </Button>
                                    </li>
                                ))
                            )}
                        </ul>
                    )}
                    {selected && (
                        <div className="grid gap-2 border-t border-line pt-3 dark:border-night-line">
                            <p className="m-0 text-sm text-muted dark:text-night-muted">
                                {t('productRequests.product.confirmHint', { name: selected.name })}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button loading={busy} onClick={confirm} size="small">
                                    {t('productRequests.product.confirm')}
                                </Button>
                                {current && (
                                    <Button
                                        disabled={busy}
                                        onClick={() => {
                                            setSelected(undefined);
                                            setChoosing(false);
                                        }}
                                        size="small"
                                        variant="ghost"
                                    >
                                        {t('common.actions.cancel')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </SectionCard>
    );
}
