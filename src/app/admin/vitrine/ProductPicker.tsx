'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import type { AdminProduct, Page } from '@/types/api';

export interface PickedProduct {
    id: string;
    name: string;
}

interface ProductPickerProps {
    label: string;
    hint?: string;
    value: PickedProduct | null;
    onChange: (product: PickedProduct | null) => void;
}

/** Busca um produto da loja pelo nome (só a vitrine: nada da CoinShop nem do "Leve junto"). */
export function ProductPicker({ label, hint, value, onChange }: ProductPickerProps) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<AdminProduct[]>([]);

    useEffect(() => {
        const term = search.trim();
        if (term.length < 2) return;
        let active = true;
        const timer = setTimeout(() => {
            const query = new URLSearchParams({ search: term, kind: 'STORE', limit: '8', page: '1' });
            api<Page<AdminProduct>>(`/products?${query.toString()}`)
                .then((page) => {
                    if (active) setResults(page.data);
                })
                .catch(() => {
                    if (active) setResults([]);
                });
        }, 250);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [search]);

    if (value)
        return (
            <div className="grid gap-1">
                <span className="text-sm font-semibold text-ink dark:text-night-text">{label}</span>
                <div className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm dark:border-night-line">
                    <span className="min-w-0 truncate">{value.name}</span>
                    <button
                        className="cursor-pointer text-xs font-semibold text-primary dark:text-night-accent"
                        onClick={() => onChange(null)}
                        type="button"
                    >
                        {t('storefront.product.change')}
                    </button>
                </div>
                {hint && <span className="text-xs text-muted dark:text-night-muted">{hint}</span>}
            </div>
        );

    return (
        <div className="grid gap-1">
            <Input
                hint={hint}
                label={label}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('storefront.product.searchPlaceholder')}
                value={search}
            />
            {search.trim().length >= 2 && (
                <ul className="m-0 grid max-h-56 list-none gap-0.5 overflow-auto rounded-md border border-line p-1 dark:border-night-line">
                    {results.length === 0 && (
                        <li className="px-2 py-1.5 text-xs text-muted dark:text-night-muted">
                            {t('storefront.product.noResults')}
                        </li>
                    )}
                    {results.map((product) => (
                        <li key={product.id}>
                            <button
                                className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm hover:bg-brand-50 dark:hover:bg-night-raised"
                                onClick={() => {
                                    onChange({ id: product.id, name: product.name });
                                    setSearch('');
                                }}
                                type="button"
                            >
                                {product.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
