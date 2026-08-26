'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { FolderPlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminCategory, AdminSubcategory } from '@/types/api';

function slugify(value: string) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function CategoriesPage() {
    const { t } = useTranslation();
    const [categories, setCategories] = useState<AdminCategory[]>();
    const [error, setError] = useState<string>();
    const [feedback, setFeedback] = useState<string>();
    const [busy, setBusy] = useState<string>();
    const [editingCategoryId, setEditingCategoryId] = useState<string>();
    const [addingSubcategoryFor, setAddingSubcategoryFor] = useState<string>();
    const [editingSubcategory, setEditingSubcategory] = useState<{ categoryId: string; subcategoryId: string }>();
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategorySlug, setNewCategorySlug] = useState('');
    const [editingNewCategorySlug, setEditingNewCategorySlug] = useState(false);

    function load() {
        api<AdminCategory[]>('/categories')
            .then(setCategories)
            .catch(() => setError(t('categories.error')));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function errorMessage(err: unknown) {
        return err instanceof ApiError ? err.message : t('categories.actionError');
    }

    async function createCategory(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy('create-category');
        setError(undefined);
        setFeedback(undefined);
        try {
            await api('/categories', {
                method: 'POST',
                body: JSON.stringify({ name: newCategoryName, slug: newCategorySlug }),
            });
            setNewCategoryName('');
            setNewCategorySlug('');
            setEditingNewCategorySlug(false);
            setFeedback(t('categories.createdFeedback'));
            load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function updateCategory(id: string, event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(`update-category:${id}`);
        setError(undefined);
        try {
            await api(`/categories/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: String(data.get('name')), slug: String(data.get('slug')) }),
            });
            setEditingCategoryId(undefined);
            load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function deleteCategory(id: string) {
        if (!confirm(t('categories.deleteCategoryConfirm'))) return;
        setBusy(`delete-category:${id}`);
        setError(undefined);
        try {
            await api(`/categories/${id}`, { method: 'DELETE' });
            load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function createSubcategory(categoryId: string, event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy(`create-subcategory:${categoryId}`);
        setError(undefined);
        try {
            await api(`/categories/${categoryId}/subcategories`, {
                method: 'POST',
                body: JSON.stringify({ name: String(data.get('name')), slug: String(data.get('slug')) }),
            });
            setAddingSubcategoryFor(undefined);
            load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function updateSubcategory(categoryId: string, subcategoryId: string, event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(`update-subcategory:${subcategoryId}`);
        setError(undefined);
        try {
            await api(`/categories/${categoryId}/subcategories/${subcategoryId}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: String(data.get('name')), slug: String(data.get('slug')) }),
            });
            setEditingSubcategory(undefined);
            load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    async function deleteSubcategory(categoryId: string, subcategoryId: string) {
        if (!confirm(t('categories.deleteSubcategoryConfirm'))) return;
        setBusy(`delete-subcategory:${subcategoryId}`);
        setError(undefined);
        try {
            await api(`/categories/${categoryId}/subcategories/${subcategoryId}`, { method: 'DELETE' });
            load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(undefined);
        }
    }

    return (
        <main>
            <p className="mm-kicker mb-3">{t('categories.kicker')}</p>
            <h1 className="m-0 text-3xl tracking-[-.03em]">{t('categories.title')}</h1>

            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}
            {feedback && <p className="mt-6 border-l-2 border-success pl-3 text-sm text-success">{feedback}</p>}

            <section className="mm-panel mt-8 max-w-xl p-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-night-brand-hover dark:text-night-accent">
                        <FolderPlus className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="m-0 text-lg">{t('categories.newCategory.title')}</h2>
                        <p className="m-0 text-sm text-muted dark:text-night-muted">{t('categories.newCategory.description')}</p>
                    </div>
                </div>
                <form className="mt-5 grid gap-4" onSubmit={createCategory}>
                    <Input
                        name="name"
                        label={t('categories.newCategory.nameLabel')}
                        placeholder={t('categories.newCategory.namePlaceholder')}
                        required
                        value={newCategoryName}
                        onChange={(event) => {
                            const name = event.target.value;
                            setNewCategoryName(name);
                            if (!editingNewCategorySlug) setNewCategorySlug(slugify(name));
                        }}
                    />

                    <div className="grid gap-2">
                        <span className="text-sm font-semibold text-ink dark:text-night-text">{t('categories.newCategory.slugLabel')}</span>
                        {editingNewCategorySlug ? (
                            <div className="flex items-center gap-2">
                                <input
                                    className="min-h-12 w-full rounded-md border border-line bg-surface px-4 py-3 text-base text-ink shadow-sm transition hover:border-brand-300 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 focus:outline-none dark:border-night-line dark:bg-night-surface dark:text-night-text dark:focus:border-night-accent/70 dark:focus:ring-brand-900/50"
                                    name="slug"
                                    autoFocus
                                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                    placeholder={t('categories.newCategory.slugPlaceholder')}
                                    required
                                    value={newCategorySlug}
                                    onChange={(event) => setNewCategorySlug(slugify(event.target.value))}
                                />
                                <button
                                    className="shrink-0 text-xs font-semibold text-primary hover:underline dark:text-night-accent"
                                    type="button"
                                    onClick={() => {
                                        setEditingNewCategorySlug(false);
                                        setNewCategorySlug(slugify(newCategoryName));
                                    }}
                                >
                                    {t('categories.newCategory.slugAutoButton')}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-line bg-warm-100 px-4 py-3 dark:border-night-line dark:bg-night-raised">
                                <span className="truncate font-mono text-sm text-muted dark:text-night-muted">
                                    /{newCategorySlug || t('categories.newCategory.slugGeneratedPlaceholder')}
                                </span>
                                <button
                                    className="shrink-0 text-xs font-semibold text-primary hover:underline dark:text-night-accent"
                                    type="button"
                                    onClick={() => setEditingNewCategorySlug(true)}
                                >
                                    {t('categories.newCategory.slugEditButton')}
                                </button>
                            </div>
                        )}
                        <span className="text-xs leading-relaxed text-muted dark:text-night-muted">{t('categories.newCategory.slugHint')}</span>
                    </div>

                    <div className="mt-1 flex justify-end max-[500px]:justify-stretch">
                        <Button
                            className="max-[500px]:w-full"
                            type="submit"
                            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                            loading={busy === 'create-category'}
                        >
                            {t('categories.newCategory.submitButton')}
                        </Button>
                    </div>
                </form>
            </section>

            {!categories && !error && <p className="mt-8 text-muted">{t('categories.loading')}</p>}

            {categories && (
                <div className="mt-8 grid gap-5">
                    {categories.map((category) => (
                        <section className="mm-panel p-6" key={category.id}>
                            {editingCategoryId === category.id ? (
                                <form className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 max-[560px]:grid-cols-1" onSubmit={(event) => updateCategory(category.id, event)}>
                                    <label className="grid gap-2 text-sm font-semibold">
                                        {t('categories.editForm.name')}
                                        <input
                                            className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            name="name"
                                            defaultValue={category.name}
                                            placeholder={t('categories.newCategory.namePlaceholder')}
                                            required
                                        />
                                    </label>
                                    <label className="grid gap-2 text-sm font-semibold">
                                        {t('categories.editForm.slug')}
                                        <input
                                            className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            name="slug"
                                            defaultValue={category.slug}
                                            placeholder={t('categories.newCategory.slugPlaceholder')}
                                            required
                                        />
                                    </label>
                                    <div className="flex gap-2">
                                        <Button size="small" type="submit" loading={busy === `update-category:${category.id}`}>
                                            {t('categories.editForm.save')}
                                        </Button>
                                        <Button size="small" type="button" variant="ghost" onClick={() => setEditingCategoryId(undefined)}>
                                            <X className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <h2 className="m-0 text-xl">{category.name}</h2>
                                        <p className="mt-1 text-sm text-muted dark:text-night-muted">/{category.slug}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="small" variant="ghost" onClick={() => setEditingCategoryId(category.id)}>
                                            <Pencil className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="ghost"
                                            className="text-origin-700"
                                            onClick={() => deleteCategory(category.id)}
                                            loading={busy === `delete-category:${category.id}`}
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="mt-5 border-t border-line pt-4 dark:border-night-line">
                                <h3 className="m-0 text-sm font-bold tracking-wide text-muted uppercase dark:text-night-subtle">
                                    {t('categories.subcategories.title')}
                                </h3>
                                <ul className="m-0 mt-3 grid list-none gap-2 p-0">
                                    {category.subcategories.map((subcategory: AdminSubcategory) =>
                                        editingSubcategory?.subcategoryId === subcategory.id ? (
                                            <li key={subcategory.id}>
                                                <form
                                                    className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 max-[560px]:grid-cols-1"
                                                    onSubmit={(event) => updateSubcategory(category.id, subcategory.id, event)}
                                                >
                                                    <input
                                                        className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                                        name="name"
                                                        defaultValue={subcategory.name}
                                                        placeholder={t('categories.subcategories.editNamePlaceholder')}
                                                        required
                                                    />
                                                    <input
                                                        className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                                        name="slug"
                                                        defaultValue={subcategory.slug}
                                                        placeholder={t('categories.subcategories.editSlugPlaceholder')}
                                                        required
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button size="small" type="submit" loading={busy === `update-subcategory:${subcategory.id}`}>
                                                            {t('categories.editForm.save')}
                                                        </Button>
                                                        <Button size="small" type="button" variant="ghost" onClick={() => setEditingSubcategory(undefined)}>
                                                            <X className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                    </div>
                                                </form>
                                            </li>
                                        ) : (
                                            <li
                                                className="flex items-center justify-between gap-4 rounded-md bg-warm-100 px-4 py-2 text-sm dark:bg-night-raised"
                                                key={subcategory.id}
                                            >
                                                <span>
                                                    {subcategory.name}{' '}
                                                    <span className="text-muted dark:text-night-muted">/{subcategory.slug}</span>
                                                </span>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="small"
                                                        variant="ghost"
                                                        onClick={() => setEditingSubcategory({ categoryId: category.id, subcategoryId: subcategory.id })}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="ghost"
                                                        className="text-origin-700"
                                                        onClick={() => deleteSubcategory(category.id, subcategory.id)}
                                                        loading={busy === `delete-subcategory:${subcategory.id}`}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </Button>
                                                </div>
                                            </li>
                                        ),
                                    )}
                                    {category.subcategories.length === 0 && (
                                        <li className="text-sm text-muted dark:text-night-muted">{t('categories.subcategories.empty')}</li>
                                    )}
                                </ul>

                                {addingSubcategoryFor === category.id ? (
                                    <form
                                        className="mt-4 grid grid-cols-[1fr_1fr_auto] items-end gap-3 max-[560px]:grid-cols-1"
                                        onSubmit={(event) => createSubcategory(category.id, event)}
                                    >
                                        <input
                                            className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            name="name"
                                            placeholder={t('categories.subcategories.namePlaceholder')}
                                            required
                                        />
                                        <input
                                            className="min-h-10 rounded-md border border-line bg-surface px-3 dark:border-night-line dark:bg-night-canvas"
                                            name="slug"
                                            placeholder={t('categories.subcategories.slugPlaceholder')}
                                            required
                                        />
                                        <div className="flex gap-2">
                                            <Button size="small" type="submit" loading={busy === `create-subcategory:${category.id}`}>
                                                {t('categories.subcategories.add')}
                                            </Button>
                                            <Button size="small" type="button" variant="ghost" onClick={() => setAddingSubcategoryFor(undefined)}>
                                                <X className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </form>
                                ) : (
                                    <Button className="mt-4" size="small" variant="ghost" onClick={() => setAddingSubcategoryFor(category.id)}>
                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                        {t('categories.subcategories.addButton')}
                                    </Button>
                                )}
                            </div>
                        </section>
                    ))}
                    {categories.length === 0 && <p className="text-muted">{t('categories.emptyAll')}</p>}
                </div>
            )}
        </main>
    );
}
