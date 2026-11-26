'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Settings as SettingsIcon } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { normalize } from '@/services/admin/normalize';
import { api, ApiError } from '@/services/api';
import { useAdminAccountAuth } from '@/services/auth/admin-account-auth';
import type { AdminSetting } from '@/types/api';
import { SettingFormDialog } from './SettingFormDialog';
import { describeSetting, friendlySettingValue, SETTING_GROUPS } from './settings-catalog';

export function SettingsPage() {
    const { locale, t } = useTranslation();
    const { admin } = useAdminAccountAuth();
    const { notify } = useToast();
    const [settings, setSettings] = useState<AdminSetting[]>();
    const [error, setError] = useState<string>();
    const [search, setSearch] = useState('');
    const [target, setTarget] = useState('');
    const [editing, setEditing] = useState<AdminSetting>();

    const load = useCallback(() => {
        api<AdminSetting[]>('/settings')
            .then((list) => {
                setSettings(list);
                setError(undefined);
            })
            .catch((err) =>
                setError(err instanceof ApiError && err.status === 403 ? t('settings.forbidden') : t('settings.error')),
            );
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    async function submitEdit(value: string) {
        if (!editing) return;
        await api(`/settings/${editing.key}`, { method: 'PATCH', body: JSON.stringify({ value }) });
        notify({
            tone: 'success',
            title: t('settings.updatedFeedback', { key: describeSetting(editing.key, t).name }),
        });
        setEditing(undefined);
        load();
    }

    const groups = useMemo(() => {
        const described = (settings ?? []).map((setting) => ({ setting, ...describeSetting(setting.key, t) }));
        const term = normalize(search);
        const matching = term
            ? described.filter(({ setting, name }) =>
                  normalize(`${name} ${setting.key} ${setting.description ?? ''}`).includes(term),
              )
            : described;
        return SETTING_GROUPS.map((group) => ({
            group,
            rows: matching.filter((row) => row.group === group).sort((a, b) => a.order - b.order),
        })).filter(({ rows }) => rows.length > 0);
    }, [search, settings, t]);

    // `#chave` vem da busca geral: leva direto à linha, depois de carregada.
    // Destaque por estado, porque o `:target` do navegador só vale para o que
    // já existia na hora de abrir o endereço.
    useEffect(() => {
        if (!settings) return;
        const showTarget = () => {
            const key = window.location.hash.slice(1);
            setTarget(key);
            if (key) requestAnimationFrame(() => document.getElementById(key)?.scrollIntoView({ block: 'center' }));
        };
        const frame = requestAnimationFrame(showTarget);
        window.addEventListener('hashchange', showTarget);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('hashchange', showTarget);
        };
    }, [settings]);

    return (
        <div className="grid gap-6">
            <PageHeader
                actions={
                    admin?.role === 'SUPERADMIN' && (
                        <ButtonLink href="/admin/servicos-adicionais" variant="secondary">
                            {t('settings.optionalServicesLink')}
                        </ButtonLink>
                    )
                }
                description={t('settings.description')}
                title={t('settings.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            {!error && !settings && <SkeletonCards label={t('settings.loading')} />}

            {!error && settings && (
                <>
                    <SearchInput
                        className="max-w-md"
                        label={t('settings.searchLabel')}
                        onChange={setSearch}
                        placeholder={t('settings.searchPlaceholder')}
                        value={search}
                    />
                    {groups.length === 0 && (
                        <SectionCard>
                            <EmptyState icon={SettingsIcon} title={t('settings.empty')} />
                        </SectionCard>
                    )}
                    {groups.map(({ group, rows }) => (
                        <SectionCard flush key={group} title={t(`settings.groups.${group}`)}>
                            <ul className="m-0 list-none p-0">
                                {rows.map(({ setting, name, unit }) => {
                                    const friendly = friendlySettingValue(setting.value, unit, locale, t);
                                    return (
                                        <li
                                            className={`flex scroll-mt-24 items-start gap-4 border-b border-line px-5 py-3 last:border-b-0 dark:border-night-line ${
                                                target === setting.key ? 'bg-brand-50 dark:bg-night-brand' : ''
                                            }`}
                                            id={setting.key}
                                            key={setting.key}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="m-0 text-sm font-semibold text-ink dark:text-night-text">
                                                    {name}
                                                </p>
                                                {setting.description && (
                                                    <p className="mt-0.5 mb-0 max-w-3xl text-sm leading-snug text-muted dark:text-night-muted">
                                                        {setting.description}
                                                    </p>
                                                )}
                                                {name !== setting.key && (
                                                    <p className="mt-0.5 mb-0 font-mono text-xs break-all text-muted dark:text-night-subtle">
                                                        {setting.key}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="mm-data m-0 text-sm font-semibold text-ink dark:text-night-text">
                                                    {friendly ?? setting.value}
                                                </p>
                                                {friendly && (
                                                    <p className="mm-data m-0 text-xs text-muted dark:text-night-muted">
                                                        {setting.value}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                aria-label={t('settings.editAria', { key: name })}
                                                iconOnly
                                                onClick={() => setEditing(setting)}
                                                size="small"
                                                variant="ghost"
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </SectionCard>
                    ))}
                </>
            )}

            <SettingFormDialog
                name={editing ? describeSetting(editing.key, t).name : undefined}
                onClose={() => setEditing(undefined)}
                onSubmit={submitEdit}
                open={editing !== undefined}
                setting={editing}
            />
        </div>
    );
}
