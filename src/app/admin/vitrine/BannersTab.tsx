'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill, type StatusTone } from '@/components/admin/StatusPill';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { fromDateTimeLocal, toDateTimeLocal } from '../cupons/coupon-format';
import { ImageUploadField } from './ImageUploadField';
import { ProductPicker, type PickedProduct } from './ProductPicker';
import type { BannerStatus, HomeBanner } from './storefront-types';

const TONES: Record<BannerStatus, StatusTone> = {
    LIVE: 'success',
    SCHEDULED: 'info',
    ENDED: 'neutral',
    INACTIVE: 'neutral',
};

/**
 * Banner principal da home. Vários podem estar cadastrados, mas o site mostra
 * um só: o ativo, dentro do período, que começou por último. Agendar o
 * próximo é criar outro com a data de início.
 */
export function BannersTab() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [banners, setBanners] = useState<HomeBanner[]>();
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState<{ banner?: HomeBanner } | null>(null);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        api<HomeBanner[]>('/home/banners')
            .then(setBanners)
            .catch(() => setError(t('storefront.loadError')));
    }, [t, version]);

    return (
        <SectionCard
            action={<Button onClick={() => setEditing({})}>{t('storefront.banners.new')}</Button>}
            description={t('storefront.banners.description')}
            title={t('storefront.banners.title')}
        >
            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
            {!banners && !error && <p className="text-sm text-muted">{t('common.loading')}</p>}
            {banners?.length === 0 && (
                <p className="text-sm text-muted dark:text-night-muted">{t('storefront.banners.empty')}</p>
            )}
            <ul className="m-0 grid list-none gap-2 p-0">
                {banners?.map((banner) => (
                    <li
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 dark:border-night-line"
                        key={banner.id}
                    >
                        {(banner.image?.url ?? banner.product.imageUrl) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                alt=""
                                className="h-12 w-12 rounded-md object-cover"
                                src={banner.image?.url ?? banner.product.imageUrl ?? ''}
                            />
                        )}
                        <span className="grid min-w-0 flex-1">
                            <strong className="truncate text-sm">{banner.title}</strong>
                            <span className="truncate text-xs text-muted dark:text-night-muted">
                                {banner.product.name}
                            </span>
                        </span>
                        <span className="text-xs text-muted dark:text-night-muted">
                            {banner.startsAt ? new Date(banner.startsAt).toLocaleString('pt-BR') : '—'} →{' '}
                            {banner.endsAt
                                ? new Date(banner.endsAt).toLocaleString('pt-BR')
                                : t('storefront.banners.noEnd')}
                        </span>
                        <StatusPill tone={banner.isCurrent ? 'success' : TONES[banner.status]}>
                            {banner.isCurrent
                                ? t('storefront.banners.current')
                                : t(`storefront.banners.status.${banner.status}`)}
                        </StatusPill>
                        <Button onClick={() => setEditing({ banner })} size="small" variant="secondary">
                            {t('storefront.edit')}
                        </Button>
                    </li>
                ))}
            </ul>

            {editing && (
                <BannerDialog
                    banner={editing.banner}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        setVersion((value) => value + 1);
                        notify({ tone: 'success', title: t('storefront.banners.saved') });
                    }}
                />
            )}
        </SectionCard>
    );
}

function BannerDialog({ banner, onClose, onSaved }: { banner?: HomeBanner; onClose: () => void; onSaved: () => void }) {
    const { t } = useTranslation();
    const needsEnrollment = useTotpEnrollmentGate(true, true);
    const [product, setProduct] = useState<PickedProduct | null>(
        banner ? { id: banner.product.id, name: banner.product.name } : null,
    );
    const [imageKey, setImageKey] = useState<string | null>(banner?.image?.key ?? null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    if (needsEnrollment) return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!product) return setError(t('storefront.banners.productRequired'));
        const data = new FormData(event.currentTarget);
        const text = (name: string) => String(data.get(name) ?? '').trim() || null;
        const imageAlt = text('imageAlt');
        if (imageKey && !imageAlt) return setError(t('storefront.image.altRequired'));
        setBusy(true);
        setError(undefined);
        try {
            await api(banner ? `/home/banners/${banner.id}` : '/home/banners', {
                method: banner ? 'PATCH' : 'POST',
                body: JSON.stringify({
                    productId: product.id,
                    label: text('label'),
                    title: text('title') ?? '',
                    body: text('body'),
                    ctaLabel: text('ctaLabel') ?? 'Comprar',
                    imageKey,
                    imageAlt: imageKey ? imageAlt : null,
                    isActive: data.get('isActive') === 'on',
                    startsAt: fromDateTimeLocal(String(data.get('startsAt') ?? '')),
                    endsAt: fromDateTimeLocal(String(data.get('endsAt') ?? '')),
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
                    <Button form="banner-form" loading={busy} type="submit">
                        {t('common.actions.save')}
                    </Button>
                </>
            }
            onClose={onClose}
            open
            size="large"
            title={banner ? t('storefront.banners.editTitle') : t('storefront.banners.new')}
        >
            <form className="grid gap-4 sm:grid-cols-2" id="banner-form" onSubmit={handleSubmit}>
                <div className="sm:col-span-2">
                    <ProductPicker
                        hint={t('storefront.banners.productHint')}
                        label={t('storefront.banners.product')}
                        onChange={setProduct}
                        value={product}
                    />
                </div>
                <Input
                    defaultValue={banner?.label ?? ''}
                    label={t('storefront.banners.label')}
                    maxLength={40}
                    name="label"
                    placeholder="Novo no estoque"
                />
                <Input
                    defaultValue={banner?.ctaLabel ?? 'Comprar'}
                    label={t('storefront.banners.ctaLabel')}
                    maxLength={30}
                    name="ctaLabel"
                />
                <Input
                    defaultValue={banner?.title ?? ''}
                    fieldClassName="sm:col-span-2"
                    label={t('storefront.banners.fieldTitle')}
                    maxLength={80}
                    minLength={2}
                    name="title"
                    required
                />
                <Input
                    defaultValue={banner?.body ?? ''}
                    fieldClassName="sm:col-span-2"
                    hint={t('storefront.banners.bodyHint')}
                    label={t('storefront.banners.body')}
                    maxLength={160}
                    name="body"
                />
                <div className="sm:col-span-2">
                    <ImageUploadField
                        aspect="wide"
                        currentUrl={banner?.image?.url ?? null}
                        hint={t('storefront.banners.imageHint')}
                        label={t('storefront.banners.image')}
                        onBusyChange={setBusy}
                        onError={setError}
                        onUploaded={setImageKey}
                        target="BANNER"
                    />
                    {imageKey && (
                        <button
                            className="mt-2 cursor-pointer text-xs font-semibold text-primary dark:text-night-accent"
                            onClick={() => setImageKey(null)}
                            type="button"
                        >
                            {t('storefront.banners.useProductPhoto')}
                        </button>
                    )}
                </div>
                <Input
                    defaultValue={banner?.image?.alt ?? ''}
                    fieldClassName="sm:col-span-2"
                    label={t('storefront.image.alt')}
                    maxLength={300}
                    name="imageAlt"
                />
                <Input
                    defaultValue={toDateTimeLocal(banner?.startsAt ?? null)}
                    label={t('storefront.banners.startsAt')}
                    name="startsAt"
                    type="datetime-local"
                />
                <Input
                    defaultValue={toDateTimeLocal(banner?.endsAt ?? null)}
                    label={t('storefront.banners.endsAt')}
                    name="endsAt"
                    type="datetime-local"
                />
                <Checkbox
                    className="sm:col-span-2"
                    defaultChecked={banner?.isActive ?? true}
                    label={t('storefront.banners.isActive')}
                    name="isActive"
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
                    <Alert className="sm:col-span-2" tone="danger">
                        <p>{error}</p>
                    </Alert>
                )}
            </form>
        </Modal>
    );
}
