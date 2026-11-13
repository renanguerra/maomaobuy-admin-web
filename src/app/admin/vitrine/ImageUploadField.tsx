'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, uploadToPresignedUrl } from '@/services/api';
import type { PresignedUpload } from '@/types/api';
import type { StorefrontImageTarget } from './storefront-types';

/** Os mesmos limites do backend: sem SVG e sem GIF; tudo vira WebP no salvar. */
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

interface ImageUploadFieldProps {
    target: StorefrontImageTarget;
    label: string;
    hint: string;
    /** URL da imagem já salva, para a prévia. */
    currentUrl: string | null;
    aspect?: 'square' | 'portrait' | 'wide';
    onUploaded: (key: string) => void;
    onError: (message: string) => void;
    onBusyChange?: (busy: boolean) => void;
}

/**
 * Envia na hora da escolha, direto ao storage. O arquivo só chega ao site
 * quando o formulário é salvo com TOTP; até lá é rascunho.
 */
export function ImageUploadField({
    target,
    label,
    hint,
    currentUrl,
    aspect = 'square',
    onUploaded,
    onError,
    onBusyChange,
}: ImageUploadFieldProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState(currentUrl);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!preview?.startsWith('blob:')) return;
        return () => URL.revokeObjectURL(preview);
    }, [preview]);

    async function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!IMAGE_MIME_TYPES.includes(file.type)) return onError(t('storefront.image.unsupported'));
        if (file.size > IMAGE_MAX_BYTES) return onError(t('storefront.image.tooLarge'));
        setUploading(true);
        onBusyChange?.(true);
        try {
            const presigned = await api<PresignedUpload>('/home/images/upload-url', {
                method: 'POST',
                body: JSON.stringify({ target, mimeType: file.type, sizeBytes: file.size }),
            });
            const response = await uploadToPresignedUrl(presigned, file);
            if (!response.ok) throw new Error(t('storefront.image.uploadFailed'));
            onUploaded(presigned.key);
            setPreview(URL.createObjectURL(file));
        } catch (err) {
            onError(err instanceof Error ? err.message : t('storefront.image.uploadFailed'));
        } finally {
            setUploading(false);
            onBusyChange?.(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    }

    const ratio = aspect === 'portrait' ? 'aspect-[4/5]' : aspect === 'wide' ? 'aspect-[16/9]' : 'aspect-square';
    return (
        <div className="grid gap-2">
            <span className="text-sm font-semibold text-ink dark:text-night-text">{label}</span>
            <div
                className={`${ratio} w-full max-w-56 overflow-hidden rounded-lg border border-dashed border-line bg-surface dark:border-night-line dark:bg-night-surface`}
            >
                {preview ? (
                    // Prévia local (`blob:`) ou do bucket público: o otimizador do Next não serve nenhum dos dois.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-full w-full object-cover" src={preview} />
                ) : (
                    <span className="grid h-full place-items-center p-3 text-center text-xs text-muted dark:text-night-muted">
                        {t('storefront.image.empty')}
                    </span>
                )}
            </div>
            <input
                accept={IMAGE_MIME_TYPES.join(',')}
                className="sr-only"
                onChange={handleChange}
                ref={inputRef}
                type="file"
            />
            <div className="flex flex-wrap items-center gap-3">
                <Button loading={uploading} onClick={() => inputRef.current?.click()} type="button" variant="secondary">
                    {preview ? t('storefront.image.replace') : t('storefront.image.choose')}
                </Button>
                <span className="text-xs text-muted dark:text-night-muted">{hint}</span>
            </div>
        </div>
    );
}
