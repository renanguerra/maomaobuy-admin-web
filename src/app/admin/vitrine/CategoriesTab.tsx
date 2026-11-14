'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { ImageUploadField } from './ImageUploadField';
import type { CategoryShortcut } from './storefront-types';

const MAX_ON_HOME = 8;

/**
 * Fotos dos atalhos de categoria da home. Sem ordem nem escolha: categoria
 * com foto aparece na home, em ordem alfabética, até oito (14/11/2026).
 */
export function CategoriesTab() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [categories, setCategories] = useState<CategoryShortcut[]>();
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState<CategoryShortcut | null>(null);

    function load() {
        api<CategoryShortcut[]>('/home/categories')
            .then(setCategories)
            .catch(() => setError(t('storefront.loadError')));
    }
    useEffect(load, [t]);

    const sorted = [...(categories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const onHome = new Set(
        sorted
            .filter((category) => category.image)
            .slice(0, MAX_ON_HOME)
            .map((category) => category.id),
    );

    return (
        <div className="grid gap-4">
            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
            <SectionCard
                description={t('storefront.categories.description', { max: MAX_ON_HOME })}
                title={t('storefront.categories.title')}
            >
                <ul className="m-0 grid list-none gap-2 p-0">
                    {sorted.map((category) => (
                        <li
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 dark:border-night-line"
                            key={category.id}
                        >
                            {category.image?.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img alt="" className="h-12 w-12 rounded-md object-cover" src={category.image.url} />
                            ) : (
                                <span className="grid h-12 w-12 place-items-center rounded-md border border-dashed border-line text-[0.65rem] text-muted dark:border-night-line">
                                    {t('storefront.categories.noPhoto')}
                                </span>
                            )}
                            <span className="grid min-w-0 flex-1">
                                <strong className="truncate text-sm">{category.name}</strong>
                                <span className="text-xs text-muted dark:text-night-muted">
                                    /{category.slug} ·{' '}
                                    {t('storefront.categories.products', { count: category.productCount })}
                                </span>
                            </span>
                            {onHome.has(category.id) ? (
                                <StatusPill tone="success">{t('storefront.categories.onHome')}</StatusPill>
                            ) : (
                                category.image && (
                                    <StatusPill tone="neutral">{t('storefront.categories.beyondLimit')}</StatusPill>
                                )
                            )}
                            <Button onClick={() => setEditing(category)} size="small" variant="secondary">
                                {t('storefront.edit')}
                            </Button>
                        </li>
                    ))}
                </ul>
            </SectionCard>

            {editing && (
                <CategoryDialog
                    category={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        load();
                        notify({ tone: 'success', title: t('storefront.categories.saved') });
                    }}
                />
            )}
        </div>
    );
}

function CategoryDialog({
    category,
    onClose,
    onSaved,
}: {
    category: CategoryShortcut;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const needsEnrollment = useTotpEnrollmentGate(true, true);
    const [imageKey, setImageKey] = useState<string | null>(category.image?.key ?? null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    if (needsEnrollment) return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const imageAlt = String(data.get('imageAlt') ?? '').trim();
        if (imageKey && !imageAlt) return setError(t('storefront.image.altRequired'));
        setBusy(true);
        setError(undefined);
        try {
            await api(`/home/categories/${category.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    imageKey,
                    imageAlt: imageKey ? imageAlt : null,
                    totpCode: String(data.get('totpCode') ?? ''),
                }),
            });
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('storefront.saveError'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            footer={
                <>
                    <Button disabled={busy} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form="category-form" loading={busy} type="submit">
                        {t('common.actions.save')}
                    </Button>
                </>
            }
            onClose={onClose}
            open
            title={t('storefront.categories.editTitle', { name: category.name })}
        >
            <form className="grid gap-4" id="category-form" onSubmit={handleSubmit}>
                <ImageUploadField
                    currentUrl={category.image?.url ?? null}
                    hint={t('storefront.categories.photoHint')}
                    label={t('storefront.categories.photo')}
                    onBusyChange={setBusy}
                    onError={setError}
                    onUploaded={setImageKey}
                    target="CATEGORY"
                />
                <Input
                    defaultValue={category.image?.alt ?? ''}
                    label={t('storefront.image.alt')}
                    maxLength={300}
                    name="imageAlt"
                />
                <Input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    label={t('common.fields.totpCode')}
                    maxLength={6}
                    name="totpCode"
                    pattern="\d{6}"
                    required
                />
                {error && (
                    <Alert tone="danger">
                        <p>{error}</p>
                    </Alert>
                )}
            </form>
        </Modal>
    );
}
