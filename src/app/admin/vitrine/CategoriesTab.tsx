'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { ImageUploadField } from './ImageUploadField';
import type { CategoryShortcut } from './storefront-types';
import { TotpModal } from './TotpModal';

const MAX_ON_HOME = 8;

/** Foto e ordem dos atalhos de categoria da home (até oito). */
export function CategoriesTab() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [categories, setCategories] = useState<CategoryShortcut[]>();
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState<CategoryShortcut | null>(null);
    const [order, setOrder] = useState<string[] | null>(null);

    function load() {
        api<CategoryShortcut[]>('/home/categories')
            .then((loaded) => {
                setCategories(loaded);
                setOrder(null);
            })
            .catch(() => setError(t('storefront.loadError')));
    }
    useEffect(load, [t]);

    const onHome = (categories ?? []).filter((category) => category.showOnHome);
    const sortedHome = order
        ? order.map((id) => onHome.find((category) => category.id === id)!).filter(Boolean)
        : onHome;
    const others = (categories ?? []).filter((category) => !category.showOnHome);

    function move(index: number, delta: number) {
        const ids = sortedHome.map((category) => category.id);
        const target = index + delta;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        setOrder(ids);
    }

    async function saveOrder(totpCode: string) {
        const saved = await api<CategoryShortcut[]>('/home/categories/order', {
            method: 'PUT',
            body: JSON.stringify({ totpCode, ids: order }),
        });
        setCategories(saved);
        setOrder(null);
        notify({ tone: 'success', title: t('storefront.categories.saved') });
    }

    const [confirmOrder, setConfirmOrder] = useState(false);

    function row(category: CategoryShortcut, index?: number) {
        return (
            <li
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 dark:border-night-line"
                key={category.id}
            >
                {index !== undefined && (
                    <span className="flex gap-1">
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
                            disabled={index === sortedHome.length - 1}
                            iconOnly
                            onClick={() => move(index, 1)}
                            size="small"
                            type="button"
                            variant="ghost"
                        >
                            <ArrowDown aria-hidden className="h-4 w-4" />
                        </Button>
                    </span>
                )}
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
                        /{category.slug} · {t('storefront.categories.products', { count: category.productCount })}
                    </span>
                </span>
                {category.showOnHome && <StatusPill tone="success">{t('storefront.categories.onHome')}</StatusPill>}
                <Button onClick={() => setEditing(category)} size="small" variant="secondary">
                    {t('storefront.edit')}
                </Button>
            </li>
        );
    }

    return (
        <div className="grid gap-4">
            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
            <SectionCard
                action={
                    <Button disabled={!order} onClick={() => setConfirmOrder(true)} type="button">
                        {t('storefront.categories.saveOrder')}
                    </Button>
                }
                description={t('storefront.categories.description', { count: onHome.length, max: MAX_ON_HOME })}
                title={t('storefront.categories.onHomeTitle')}
            >
                <ul className="m-0 grid list-none gap-2 p-0">
                    {sortedHome.map((category, index) => row(category, index))}
                </ul>
            </SectionCard>
            <SectionCard title={t('storefront.categories.othersTitle')}>
                <ul className="m-0 grid list-none gap-2 p-0">{others.map((category) => row(category))}</ul>
            </SectionCard>

            <TotpModal
                onClose={() => setConfirmOrder(false)}
                onConfirm={async (code) => {
                    await saveOrder(code);
                    setConfirmOrder(false);
                }}
                open={confirmOrder}
                title={t('storefront.categories.saveOrder')}
            />

            {editing && (
                <CategoryDialog
                    category={editing}
                    full={onHome.length >= MAX_ON_HOME}
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
    full,
    onClose,
    onSaved,
}: {
    category: CategoryShortcut;
    full: boolean;
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
        const showOnHome = data.get('showOnHome') === 'on';
        if (imageKey && !imageAlt) return setError(t('storefront.image.altRequired'));
        if (showOnHome && !imageKey) return setError(t('storefront.categories.photoRequired'));
        setBusy(true);
        setError(undefined);
        try {
            await api(`/home/categories/${category.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    imageKey,
                    imageAlt: imageKey ? imageAlt : null,
                    showOnHome,
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
                <Checkbox
                    defaultChecked={category.showOnHome}
                    disabled={full && !category.showOnHome}
                    label={
                        full && !category.showOnHome
                            ? t('storefront.categories.homeFull')
                            : t('storefront.categories.showOnHome')
                    }
                    name="showOnHome"
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
