'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { FilterTabs } from '@/components/admin/FilterTabs';
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
import { ImageUploadField } from './ImageUploadField';
import { ProductPicker, type PickedProduct } from './ProductPicker';
import type { FeedbackPost, FeedbackStatus } from './storefront-types';

const TONES: Record<FeedbackStatus, StatusTone> = {
    LIVE: 'success',
    AWAITING_AUTHORIZATION: 'warning',
    HIDDEN: 'neutral',
};

/**
 * Posts de unboxing do Instagram em "Quem comprou, mostrou". Cadastro à mão:
 * foto, @ e link. Só vai ao site o post com a autorização do cliente marcada.
 */
export function FeedbacksTab() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [status, setStatus] = useState<FeedbackStatus>('LIVE');
    const [posts, setPosts] = useState<FeedbackPost[]>();
    const [error, setError] = useState<string>();
    const [editing, setEditing] = useState<{ post?: FeedbackPost } | null>(null);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        api<FeedbackPost[]>(`/home/feedback-posts?status=${status}`)
            .then(setPosts)
            .catch(() => setError(t('storefront.loadError')));
    }, [status, version, t]);

    return (
        <SectionCard
            action={<Button onClick={() => setEditing({})}>{t('storefront.feedbacks.new')}</Button>}
            description={t('storefront.feedbacks.description')}
            title={t('storefront.feedbacks.title')}
        >
            <FilterTabs
                label={t('storefront.feedbacks.title')}
                onChange={setStatus}
                options={(['LIVE', 'AWAITING_AUTHORIZATION', 'HIDDEN'] as const).map((value) => ({
                    value,
                    label: t(`storefront.feedbacks.status.${value}`),
                }))}
                value={status}
            />
            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
            {posts?.length === 0 && (
                <p className="text-sm text-muted dark:text-night-muted">{t('storefront.feedbacks.empty')}</p>
            )}
            <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 xl:grid-cols-4">
                {posts?.map((post) => (
                    <li
                        className="grid overflow-hidden rounded-lg border border-line dark:border-night-line"
                        key={post.id}
                    >
                        {post.image.url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                alt={post.image.alt}
                                className="aspect-[4/5] w-full object-cover"
                                src={post.image.url}
                            />
                        )}
                        <div className="grid gap-1.5 p-3 text-sm">
                            <strong>@{post.instagramHandle}</strong>
                            <a
                                className="inline-flex items-center gap-1 text-xs text-primary dark:text-night-accent"
                                href={post.postUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                {t('storefront.feedbacks.openPost')}
                                <ExternalLink aria-hidden className="h-3 w-3" />
                            </a>
                            {post.product && <span className="truncate text-xs text-muted">{post.product.name}</span>}
                            <div className="flex items-center justify-between gap-2">
                                <StatusPill tone={TONES[post.status]}>
                                    {t(`storefront.feedbacks.status.${post.status}`)}
                                </StatusPill>
                                <Button onClick={() => setEditing({ post })} size="small" variant="secondary">
                                    {t('storefront.edit')}
                                </Button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {editing && (
                <FeedbackDialog
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        setVersion((value) => value + 1);
                        notify({ tone: 'success', title: t('storefront.feedbacks.saved') });
                    }}
                    post={editing.post}
                />
            )}
        </SectionCard>
    );
}

function FeedbackDialog({ post, onClose, onSaved }: { post?: FeedbackPost; onClose: () => void; onSaved: () => void }) {
    const { t } = useTranslation();
    const needsEnrollment = useTotpEnrollmentGate(true, true);
    const [imageKey, setImageKey] = useState<string | null>(post?.image.key ?? null);
    const [product, setProduct] = useState<PickedProduct | null>(
        post?.product ? { id: post.product.id, name: post.product.name } : null,
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    if (needsEnrollment) return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!imageKey) return setError(t('storefront.feedbacks.photoRequired'));
        const data = new FormData(event.currentTarget);
        const text = (name: string) => String(data.get(name) ?? '').trim();
        setBusy(true);
        setError(undefined);
        try {
            const body = {
                imageKey,
                imageAlt: text('imageAlt'),
                instagramHandle: text('instagramHandle'),
                postUrl: text('postUrl'),
                productId: product?.id ?? null,
                authorized: data.get('authorized') === 'on',
                authorizationNote: text('authorizationNote') || null,
                ...(post ? { isVisible: data.get('isVisible') === 'on' } : {}),
                totpCode: text('totpCode'),
            };
            await api(post ? `/home/feedback-posts/${post.id}` : '/home/feedback-posts', {
                method: post ? 'PATCH' : 'POST',
                body: JSON.stringify(body),
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
                    <Button form="feedback-form" loading={busy} type="submit">
                        {t('common.actions.save')}
                    </Button>
                </>
            }
            onClose={onClose}
            open
            size="large"
            title={post ? t('storefront.feedbacks.editTitle') : t('storefront.feedbacks.new')}
        >
            <form className="grid gap-4 sm:grid-cols-2" id="feedback-form" onSubmit={handleSubmit}>
                <div className="sm:row-span-4">
                    <ImageUploadField
                        aspect="portrait"
                        currentUrl={post?.image.url ?? null}
                        hint={t('storefront.feedbacks.photoHint')}
                        label={t('storefront.feedbacks.photo')}
                        onBusyChange={setBusy}
                        onError={setError}
                        onUploaded={setImageKey}
                        target="FEEDBACK"
                    />
                </div>
                <Input
                    defaultValue={post?.postUrl ?? ''}
                    label={t('storefront.feedbacks.postUrl')}
                    name="postUrl"
                    placeholder="https://www.instagram.com/p/…"
                    required
                />
                <Input
                    defaultValue={post ? `@${post.instagramHandle}` : ''}
                    label={t('storefront.feedbacks.handle')}
                    name="instagramHandle"
                    placeholder="@perfil"
                    required
                />
                <Input
                    defaultValue={post?.image.alt ?? ''}
                    label={t('storefront.image.alt')}
                    maxLength={300}
                    minLength={2}
                    name="imageAlt"
                    required
                />
                <ProductPicker
                    hint={t('storefront.feedbacks.productHint')}
                    label={t('storefront.feedbacks.product')}
                    onChange={setProduct}
                    value={product}
                />
                <Checkbox
                    className="sm:col-span-2"
                    defaultChecked={Boolean(post?.authorizedAt)}
                    label={t('storefront.feedbacks.authorized')}
                    name="authorized"
                />
                <Input
                    defaultValue={post?.authorizationNote ?? ''}
                    fieldClassName="sm:col-span-2"
                    hint={t('storefront.feedbacks.authorizationNoteHint')}
                    label={t('storefront.feedbacks.authorizationNote')}
                    maxLength={300}
                    name="authorizationNote"
                />
                {post && (
                    <Checkbox
                        className="sm:col-span-2"
                        defaultChecked={post.isVisible}
                        label={t('storefront.feedbacks.visible')}
                        name="isVisible"
                    />
                )}
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
