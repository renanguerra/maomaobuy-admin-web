'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { ListRow, ListRows } from '@/components/admin/ListRow';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminCategory, AdminSubcategory } from '@/types/api';
import { CategoryFormDialog, type CategoryFormValues } from './CategoryFormDialog';

type DialogState =
    | { kind: 'create-category' }
    | { kind: 'edit-category'; category: AdminCategory }
    | { kind: 'create-subcategory'; category: AdminCategory }
    | { kind: 'edit-subcategory'; category: AdminCategory; subcategory: AdminSubcategory }
    | null;

export function CategoriesPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const confirm = useConfirm();
    const [categories, setCategories] = useState<AdminCategory[]>();
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState<string>();
    const [dialog, setDialog] = useState<DialogState>(null);

    const load = useCallback(() => {
        api<AdminCategory[]>('/categories')
            .then((list) => {
                setCategories(list);
                setError(undefined);
            })
            .catch(() => setError(t('categories.error')));
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    function reportError(err: unknown) {
        notify({
            tone: 'danger',
            title: t('common.errors.actionTitle'),
            description: err instanceof ApiError ? err.message : t('categories.actionError'),
        });
    }

    /** Os quatro formulários (criar/editar × categoria/subcategoria) só diferem na rota. */
    async function submitDialog(values: CategoryFormValues) {
        if (!dialog) return;

        const body = JSON.stringify(values);
        if (dialog.kind === 'create-category') {
            await api('/categories', { method: 'POST', body });
            notify({ tone: 'success', title: t('categories.createdFeedback') });
        } else if (dialog.kind === 'edit-category') {
            await api(`/categories/${dialog.category.id}`, { method: 'PATCH', body });
            notify({ tone: 'success', title: t('categories.updatedFeedback') });
        } else if (dialog.kind === 'create-subcategory') {
            await api(`/categories/${dialog.category.id}/subcategories`, { method: 'POST', body });
            notify({ tone: 'success', title: t('categories.subcategories.createdFeedback') });
        } else {
            await api(`/categories/${dialog.category.id}/subcategories/${dialog.subcategory.id}`, {
                method: 'PATCH',
                body,
            });
            notify({ tone: 'success', title: t('categories.subcategories.updatedFeedback') });
        }

        setDialog(null);
        load();
    }

    async function deleteCategory(category: AdminCategory) {
        const confirmed = await confirm({
            title: t('categories.deleteCategoryTitle', { name: category.name }),
            description: t('categories.deleteCategoryConfirm'),
            confirmLabel: t('common.actions.delete'),
            tone: 'danger',
        });
        if (!confirmed) return;

        setBusy(`delete-category:${category.id}`);
        try {
            await api(`/categories/${category.id}`, { method: 'DELETE' });
            notify({ tone: 'success', title: t('categories.deletedFeedback') });
            load();
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    async function deleteSubcategory(category: AdminCategory, subcategory: AdminSubcategory) {
        const confirmed = await confirm({
            title: t('categories.subcategories.deleteTitle', { name: subcategory.name }),
            description: t('categories.deleteSubcategoryConfirm'),
            confirmLabel: t('common.actions.delete'),
            tone: 'danger',
        });
        if (!confirmed) return;

        setBusy(`delete-subcategory:${subcategory.id}`);
        try {
            await api(`/categories/${category.id}/subcategories/${subcategory.id}`, { method: 'DELETE' });
            notify({ tone: 'success', title: t('categories.subcategories.deletedFeedback') });
            load();
        } catch (err) {
            reportError(err);
        } finally {
            setBusy(undefined);
        }
    }

    const dialogTitle =
        dialog?.kind === 'create-category'
            ? t('categories.newCategory.title')
            : dialog?.kind === 'edit-category'
              ? t('categories.editCategoryTitle')
              : dialog?.kind === 'create-subcategory'
                ? t('categories.subcategories.addButton')
                : t('categories.subcategories.editTitle');

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('categories.description')}
                kicker={t('categories.kicker')}
                title={t('categories.title')}
                actions={
                    <Button
                        leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => setDialog({ kind: 'create-category' })}
                    >
                        {t('categories.newCategory.submitButton')}
                    </Button>
                }
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            {!categories && !error && <SkeletonCards label={t('categories.loading')} />}

            {categories && categories.length === 0 && (
                <SectionCard>
                    <EmptyState
                        description={t('categories.emptyDescription')}
                        icon={Tags}
                        title={t('categories.emptyAll')}
                        action={
                            <Button
                                leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                onClick={() => setDialog({ kind: 'create-category' })}
                                size="small"
                            >
                                {t('categories.newCategory.submitButton')}
                            </Button>
                        }
                    />
                </SectionCard>
            )}

            {categories && categories.length > 0 && (
                <div className="grid gap-4">
                    {categories.map((category) => (
                        <SectionCard
                            description={`/${category.slug}`}
                            flush
                            key={category.id}
                            title={category.name}
                            action={
                                <>
                                    <Button
                                        leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                                        onClick={() => setDialog({ kind: 'create-subcategory', category })}
                                        size="small"
                                        variant="secondary"
                                    >
                                        {t('categories.subcategories.addButton')}
                                    </Button>
                                    <Button
                                        aria-label={t('categories.editAria', { name: category.name })}
                                        iconOnly
                                        onClick={() => setDialog({ kind: 'edit-category', category })}
                                        size="small"
                                        variant="ghost"
                                    >
                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                        aria-label={t('categories.deleteAria', { name: category.name })}
                                        iconOnly
                                        loading={busy === `delete-category:${category.id}`}
                                        onClick={() => deleteCategory(category)}
                                        size="small"
                                        variant="dangerGhost"
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                </>
                            }
                        >
                            {category.subcategories.length === 0 ? (
                                <EmptyState icon={Tags} title={t('categories.subcategories.empty')} />
                            ) : (
                                <ListRows>
                                    {category.subcategories.map((subcategory) => (
                                        <li key={subcategory.id}>
                                            <ListRow
                                                meta={`/${subcategory.slug}`}
                                                title={subcategory.name}
                                                actions={
                                                    <>
                                                        <Button
                                                            aria-label={t('categories.editAria', {
                                                                name: subcategory.name,
                                                            })}
                                                            iconOnly
                                                            onClick={() =>
                                                                setDialog({
                                                                    kind: 'edit-subcategory',
                                                                    category,
                                                                    subcategory,
                                                                })
                                                            }
                                                            size="small"
                                                            variant="ghost"
                                                        >
                                                            <Pencil className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                        <Button
                                                            aria-label={t('categories.deleteAria', {
                                                                name: subcategory.name,
                                                            })}
                                                            iconOnly
                                                            loading={busy === `delete-subcategory:${subcategory.id}`}
                                                            onClick={() => deleteSubcategory(category, subcategory)}
                                                            size="small"
                                                            variant="dangerGhost"
                                                        >
                                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                    </>
                                                }
                                            />
                                        </li>
                                    ))}
                                </ListRows>
                            )}
                        </SectionCard>
                    ))}
                </div>
            )}

            <CategoryFormDialog
                onClose={() => setDialog(null)}
                onSubmit={submitDialog}
                open={dialog !== null}
                title={dialogTitle}
                description={
                    dialog?.kind === 'create-category' || dialog?.kind === 'edit-category'
                        ? t('categories.newCategory.description')
                        : t('categories.subcategories.description')
                }
                submitLabel={
                    dialog?.kind === 'edit-category' || dialog?.kind === 'edit-subcategory'
                        ? t('common.actions.save')
                        : t('common.actions.add')
                }
                initialValues={
                    dialog?.kind === 'edit-category'
                        ? { name: dialog.category.name, slug: dialog.category.slug }
                        : dialog?.kind === 'edit-subcategory'
                          ? { name: dialog.subcategory.name, slug: dialog.subcategory.slug }
                          : undefined
                }
            />
        </div>
    );
}
