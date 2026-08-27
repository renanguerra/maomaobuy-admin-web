'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import { slugify } from './slugify';

const FORM_ID = 'category-form';

export interface CategoryFormValues {
    name: string;
    slug: string;
}

interface CategoryFormDialogProps {
    open: boolean;
    title: string;
    description?: string;
    submitLabel: string;
    initialValues?: CategoryFormValues;
    onClose: () => void;
    onSubmit: (values: CategoryFormValues) => Promise<void>;
}

/**
 * Formulário de categoria e subcategoria. O slug acompanha o nome enquanto o
 * admin não o editar à mão — depois disso ele para de ser sobrescrito, porque
 * mudar o slug de algo já publicado quebra links.
 */
export function CategoryFormDialog({
    open,
    title,
    description,
    submitLabel,
    initialValues,
    onClose,
    onSubmit,
}: CategoryFormDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={description}
            onClose={onClose}
            open={open}
            title={title}
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form={FORM_ID} loading={submitting} type="submit">
                        {submitLabel}
                    </Button>
                </>
            }
        >
            {/* Montado só enquanto aberto, para que criar depois de editar não
                herde o nome e o slug do registro anterior. */}
            <CategoryForm initialValues={initialValues} onSubmit={onSubmit} onSubmittingChange={setSubmitting} />
        </Modal>
    );
}

function CategoryForm({
    initialValues,
    onSubmit,
    onSubmittingChange,
}: {
    initialValues?: CategoryFormValues;
    onSubmit: (values: CategoryFormValues) => Promise<void>;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [name, setName] = useState(initialValues?.name ?? '');
    const [slug, setSlug] = useState(initialValues?.slug ?? '');
    const [slugTouched, setSlugTouched] = useState(Boolean(initialValues));
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit({ name: name.trim(), slug });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('categories.actionError'));
        } finally {
            onSubmittingChange(false);
        }
    }

    return (
        <form className="grid gap-4" id={FORM_ID} onSubmit={handleSubmit}>
            <Input
                label={t('categories.newCategory.nameLabel')}
                onChange={(event) => {
                    setName(event.target.value);
                    if (!slugTouched) setSlug(slugify(event.target.value));
                }}
                placeholder={t('categories.newCategory.namePlaceholder')}
                required
                value={name}
            />
            <Input
                className="font-mono"
                hint={t('categories.newCategory.slugHint')}
                label={t('categories.newCategory.slugLabel')}
                onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(slugify(event.target.value));
                }}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder={t('categories.newCategory.slugPlaceholder')}
                required
                value={slug}
            />

            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
        </form>
    );
}
