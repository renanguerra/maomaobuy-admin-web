'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { ShippingModality } from '@/types/shipping-table';

/** Código a partir do nome: "Econômico" → "economico". */
function slugify(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

export function ModalityDialog({
    modality,
    nextPosition,
    onClose,
    onSaved,
}: {
    /** `null` = nova modalidade. */
    modality: ShippingModality | null;
    nextPosition: number;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [name, setName] = useState(modality?.name ?? '');
    const [code, setCode] = useState(modality?.code ?? '');
    const [codeTouched, setCodeTouched] = useState(Boolean(modality));
    const [description, setDescription] = useState(modality?.description ?? '');
    const [position, setPosition] = useState(String(modality?.position ?? nextPosition));
    const [isActive, setIsActive] = useState(modality?.isActive ?? false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(undefined);
        try {
            await api(modality ? `/shipping-table/modalities/${modality.id}` : '/shipping-table/modalities', {
                method: modality ? 'PUT' : 'POST',
                body: JSON.stringify({
                    name,
                    code,
                    description,
                    position: Number.parseInt(position, 10) || 0,
                    isActive,
                }),
            });
            onSaved();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
            setSaving(false);
        }
    }

    async function remove() {
        if (!modality) return;
        const ok = await confirm({
            title: t('shippingTable.modalityForm.delete'),
            description: t('shippingTable.modalityForm.deleteConfirm', { name: modality.name }),
            tone: 'danger',
        });
        if (!ok) return;
        setSaving(true);
        try {
            await api(`/shipping-table/modalities/${modality.id}`, { method: 'DELETE' });
            onSaved();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
            setSaving(false);
        }
    }

    return (
        <Modal
            closeLabel={t('common.actions.cancel')}
            onClose={onClose}
            open
            size="medium"
            title={modality ? t('shippingTable.modalityForm.editTitle') : t('shippingTable.modalityForm.createTitle')}
            footer={
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    {modality ? (
                        <Button disabled={saving} onClick={remove} size="small" type="button" variant="dangerGhost">
                            {t('shippingTable.modalityForm.delete')}
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button onClick={onClose} type="button" variant="secondary">
                            {t('common.actions.cancel')}
                        </Button>
                        <Button form="modality-form" loading={saving} type="submit">
                            {t('common.actions.save')}
                        </Button>
                    </div>
                </div>
            }
        >
            <form className="grid gap-4" id="modality-form" onSubmit={submit}>
                {error && (
                    <Alert tone="danger" title={t('common.errors.generic')}>
                        <p>{error}</p>
                    </Alert>
                )}
                <Input
                    label={t('shippingTable.modalityForm.name')}
                    maxLength={80}
                    onChange={(event) => {
                        setName(event.target.value);
                        if (!codeTouched) setCode(slugify(event.target.value));
                    }}
                    placeholder={t('shippingTable.modalityForm.namePlaceholder')}
                    required
                    value={name}
                />
                <div className="grid grid-cols-[1fr_8rem] gap-3">
                    <Input
                        hint={t('shippingTable.modalityForm.codeHint')}
                        label={t('shippingTable.modalityForm.code')}
                        maxLength={40}
                        onChange={(event) => {
                            setCodeTouched(true);
                            setCode(event.target.value);
                        }}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        required
                        value={code}
                    />
                    <Input
                        inputMode="numeric"
                        label={t('shippingTable.modalityForm.position')}
                        min={0}
                        onChange={(event) => setPosition(event.target.value)}
                        type="number"
                        value={position}
                    />
                </div>
                <Textarea
                    hint={t('shippingTable.modalityForm.descriptionHint')}
                    label={t('shippingTable.modalityForm.description')}
                    maxLength={2000}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    value={description}
                />
                <Checkbox
                    boxed
                    checked={isActive}
                    label={t('shippingTable.modalityForm.active')}
                    onChange={(event) => setIsActive(event.target.checked)}
                />
            </form>
        </Modal>
    );
}
