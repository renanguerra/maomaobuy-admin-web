'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/i18n/LanguageProvider';
import { slugify } from './slugify';

const FORM_ID = 'category-form';

export interface CategoryFormValues {
    name: string;
    slug: string;
    /** Só categoria: subcategoria segue a visibilidade da categoria. */
    wholesaleOnly?: boolean;
    /** Só categoria: padrões do invoice que o produto novo herda. Vazio = nulo. */
    invoiceDefaults?: InvoiceDefaults;
}

export const INVOICE_DEFAULT_FIELDS = [
    { key: 'customsNameEn', label: 'products.new.invoice.nameEn', maxLength: 64 },
    { key: 'customsNameZh', label: 'products.new.invoice.nameZh', maxLength: 100 },
    { key: 'hsCode', label: 'products.new.invoice.hsCode', maxLength: 12 },
    { key: 'customsMaterial', label: 'products.new.invoice.material', maxLength: 100 },
    { key: 'customsPurpose', label: 'products.new.invoice.purpose', maxLength: 200 },
] as const;

export type InvoiceDefaults = Record<(typeof INVOICE_DEFAULT_FIELDS)[number]['key'], string | null>;

interface CategoryFormDialogProps {
    open: boolean;
    title: string;
    description?: string;
    submitLabel: string;
    initialValues?: CategoryFormValues;
    showWholesaleOnly?: boolean;
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
    showWholesaleOnly = false,
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
            <CategoryForm
                initialValues={initialValues}
                onSubmit={onSubmit}
                onSubmittingChange={setSubmitting}
                showWholesaleOnly={showWholesaleOnly}
            />
        </Modal>
    );
}

function CategoryForm({
    initialValues,
    onSubmit,
    onSubmittingChange,
    showWholesaleOnly,
}: {
    initialValues?: CategoryFormValues;
    showWholesaleOnly: boolean;
    onSubmit: (values: CategoryFormValues) => Promise<void>;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [name, setName] = useState(initialValues?.name ?? '');
    const [slug, setSlug] = useState(initialValues?.slug ?? '');
    const [slugTouched, setSlugTouched] = useState(Boolean(initialValues));
    const [wholesaleOnly, setWholesaleOnly] = useState(initialValues?.wholesaleOnly ?? false);
    const [invoice, setInvoice] = useState<Record<string, string>>(() =>
        Object.fromEntries(INVOICE_DEFAULT_FIELDS.map(({ key }) => [key, initialValues?.invoiceDefaults?.[key] ?? ''])),
    );
    const [error, setError] = useState<string>();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit({
                name: name.trim(),
                slug,
                ...(showWholesaleOnly && {
                    wholesaleOnly,
                    invoiceDefaults: Object.fromEntries(
                        INVOICE_DEFAULT_FIELDS.map(({ key }) => [key, invoice[key].trim() || null]),
                    ) as InvoiceDefaults,
                }),
            });
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
            {showWholesaleOnly && (
                <Checkbox
                    checked={wholesaleOnly}
                    description={t('categories.newCategory.wholesaleOnlyHint')}
                    label={t('categories.newCategory.wholesaleOnlyLabel')}
                    onChange={(event) => setWholesaleOnly(event.target.checked)}
                />
            )}
            {showWholesaleOnly && (
                <details
                    className="rounded-lg border border-line p-3 dark:border-night-line"
                    open={INVOICE_DEFAULT_FIELDS.some(({ key }) => invoice[key] !== '')}
                >
                    <summary className="cursor-pointer text-sm font-semibold text-ink dark:text-night-text">
                        {t('categories.newCategory.invoiceDefaults')}
                    </summary>
                    <p className="mt-1 mb-3 text-sm text-muted dark:text-night-muted">
                        {t('categories.newCategory.invoiceDefaultsHint')}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {INVOICE_DEFAULT_FIELDS.map(({ key, label, maxLength }) => (
                            <Input
                                key={key}
                                label={t(label)}
                                maxLength={maxLength}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setInvoice((current) => ({ ...current, [key]: value }));
                                }}
                                {...(key === 'hsCode' && { inputMode: 'numeric' as const, pattern: '\\d{4,12}' })}
                                value={invoice[key]}
                            />
                        ))}
                    </div>
                </details>
            )}

            {error && (
                <Alert tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
        </form>
    );
}
