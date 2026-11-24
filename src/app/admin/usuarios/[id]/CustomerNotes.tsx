'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/admin/SectionCard';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import { formatDate } from '@/types/api';
import type { CustomerNote } from '@/types/customers';

const MAX_LENGTH = 2000;

/** Notas da equipe. O cliente nunca vê; só quem escreveu apaga. */
export function CustomerNotes({ userId, onChanged }: { userId: string; onChanged: () => void }) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const confirm = useConfirm();
    const { admin } = useAdminAccountAuth();
    const [notes, setNotes] = useState<CustomerNote[]>();
    const [failed, setFailed] = useState(false);
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        api<CustomerNote[]>(`/customers/${userId}/notes`)
            .then((loaded) => {
                setNotes(loaded);
                setFailed(false);
            })
            .catch(() => setFailed(true));
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    function notifyError(err: unknown) {
        notify({ tone: 'danger', title: err instanceof ApiError ? err.message : t('common.errors.generic') });
    }

    async function add(event: FormEvent) {
        event.preventDefault();
        if (!body.trim()) return;
        setSaving(true);
        try {
            const note = await api<CustomerNote>(`/customers/${userId}/notes`, {
                method: 'POST',
                body: JSON.stringify({ body: body.trim() }),
            });
            setNotes((current) => [note, ...(current ?? [])]);
            setBody('');
            onChanged();
        } catch (err) {
            notifyError(err);
        } finally {
            setSaving(false);
        }
    }

    async function remove(note: CustomerNote) {
        const ok = await confirm({
            title: t('customers.notes.deleteTitle'),
            description: t('customers.notes.deleteDescription'),
            confirmLabel: t('customers.notes.delete'),
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await api(`/customers/${userId}/notes/${note.id}`, { method: 'DELETE' });
            setNotes((current) => current?.filter((item) => item.id !== note.id));
            onChanged();
        } catch (err) {
            notifyError(err);
        }
    }

    return (
        <SectionCard description={t('customers.notes.description')} title={t('customers.notes.title')}>
            <form className="grid gap-2" onSubmit={(event) => void add(event)}>
                <Textarea
                    hideLabel
                    label={t('customers.notes.newLabel')}
                    maxLength={MAX_LENGTH}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder={t('customers.notes.placeholder')}
                    rows={3}
                    value={body}
                />
                <Button
                    className="justify-self-end"
                    disabled={!body.trim()}
                    loading={saving}
                    size="small"
                    type="submit"
                >
                    {t('customers.notes.add')}
                </Button>
            </form>

            {failed && (
                <p className="mt-3 mb-0 text-sm text-origin-700 dark:text-night-coral" role="alert">
                    {t('customers.notes.error')}{' '}
                    <button
                        className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-inherit underline"
                        onClick={load}
                        type="button"
                    >
                        {t('common.actions.retry')}
                    </button>
                </p>
            )}

            {notes && notes.length > 0 && (
                <ul className="m-0 mt-4 grid list-none gap-3 p-0">
                    {notes.map((note) => (
                        <li className="border-t border-line pt-3 dark:border-night-line" key={note.id}>
                            <p className="m-0 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink dark:text-night-text">
                                {note.body}
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-xs text-muted dark:text-night-muted">
                                    {note.authorName ?? t('customers.notes.unknownAuthor')} ·{' '}
                                    {formatDate(note.createdAt)}
                                </span>
                                {(admin?.role === 'SUPERADMIN' || (note.authorId && note.authorId === admin?.id)) && (
                                    <Button
                                        aria-label={t('customers.notes.delete')}
                                        iconOnly
                                        onClick={() => void remove(note)}
                                        size="small"
                                        variant="ghost"
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
