'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { SectionCard } from '@/components/admin/SectionCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { CUSTOMER_MAX_TAGS, CUSTOMER_TAG_MAX_LENGTH, type CustomerTagCount } from '@/types/customers';

/** Etiquetas da equipe no cliente. Salvam na hora, uma a uma. */
export function CustomerTags({ userId, initialTags }: { userId: string; initialTags: string[] }) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const listId = useId();
    const [tags, setTags] = useState(initialTags);
    const [known, setKnown] = useState<string[]>([]);
    const [text, setText] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;
        api<CustomerTagCount[]>('/customers/tags')
            .then((list) => {
                if (active) setKnown(list.map((tag) => tag.label));
            })
            .catch(() => {
                // Sem sugestões, a pessoa digita.
            });
        return () => {
            active = false;
        };
    }, []);

    async function save(next: string[]) {
        setSaving(true);
        try {
            const saved = await api<{ tags: string[] }>(`/customers/${userId}/tags`, {
                method: 'PUT',
                body: JSON.stringify({ tags: next }),
            });
            setTags(saved.tags);
            return true;
        } catch (err) {
            notify({ tone: 'danger', title: err instanceof ApiError ? err.message : t('common.errors.generic') });
            return false;
        } finally {
            setSaving(false);
        }
    }

    async function add(event: FormEvent) {
        event.preventDefault();
        const label = text.trim().replace(/\s+/g, ' ').toLowerCase();
        if (!label) return;
        if (tags.includes(label) || (await save([...tags, label]))) setText('');
    }

    const full = tags.length >= CUSTOMER_MAX_TAGS;

    return (
        <SectionCard description={t('customers.tags.description')} title={t('customers.tags.title')}>
            {tags.length > 0 && (
                <ul className="m-0 mb-3 flex list-none flex-wrap gap-1.5 p-0">
                    {tags.map((tag) => (
                        <li
                            className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 pl-2.5 text-xs font-semibold text-brand-800 dark:bg-night-brand dark:text-night-accent"
                            key={tag}
                        >
                            {tag}
                            <button
                                aria-label={t('customers.tags.remove', { tag })}
                                className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-inherit hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-night-brand-hover"
                                disabled={saving}
                                onClick={() => void save(tags.filter((item) => item !== tag))}
                                type="button"
                            >
                                <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {full ? (
                <p className="m-0 text-sm text-muted dark:text-night-muted">
                    {t('customers.tags.full', { count: CUSTOMER_MAX_TAGS })}
                </p>
            ) : (
                <form className="flex items-end gap-2" onSubmit={(event) => void add(event)}>
                    <Input
                        autoComplete="off"
                        fieldClassName="min-w-0 flex-1"
                        hideLabel
                        label={t('customers.tags.newLabel')}
                        list={listId}
                        maxLength={CUSTOMER_TAG_MAX_LENGTH}
                        onChange={(event) => setText(event.target.value)}
                        placeholder={t('customers.tags.placeholder')}
                        value={text}
                    />
                    <datalist id={listId}>
                        {known
                            .filter((label) => !tags.includes(label))
                            .map((label) => (
                                <option key={label} value={label} />
                            ))}
                    </datalist>
                    <Button disabled={!text.trim()} loading={saving} type="submit" variant="secondary">
                        {t('customers.tags.add')}
                    </Button>
                </form>
            )}
        </SectionCard>
    );
}
