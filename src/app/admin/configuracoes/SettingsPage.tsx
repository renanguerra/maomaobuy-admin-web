'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Settings as SettingsIcon } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHeader } from '@/components/admin/PageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { StatusPill } from '@/components/admin/StatusPill';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import type { AdminSetting } from '@/types/api';
import { SettingFormDialog } from './SettingFormDialog';

export function SettingsPage() {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [settings, setSettings] = useState<AdminSetting[]>();
    const [error, setError] = useState<string>();
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
        notify({ tone: 'success', title: t('settings.updatedFeedback', { key: editing.key }) });
        setEditing(undefined);
        load();
    }

    const columns: DataTableColumn<AdminSetting>[] = [
        {
            key: 'key',
            header: t('settings.columns.key'),
            cell: (setting) => (
                <span className="block min-w-0 truncate font-mono text-xs font-semibold text-ink dark:text-night-text">
                    {setting.key}
                </span>
            ),
        },
        {
            key: 'description',
            header: t('settings.columns.description'),
            hideBelow: 'md',
            cell: (setting) => (
                <span className="text-xs leading-relaxed text-muted dark:text-night-muted">
                    {setting.description ?? t('common.dash')}
                </span>
            ),
        },
        {
            key: 'type',
            header: t('settings.columns.type'),
            hideBelow: 'lg',
            cell: (setting) => (
                <StatusPill tone={setting.type === 'DECIMAL' ? 'info' : 'neutral'}>
                    {setting.type === 'DECIMAL' ? t('settings.typeDecimal') : t('settings.typeInteger')}
                </StatusPill>
            ),
        },
        {
            key: 'value',
            header: t('settings.columns.value'),
            numeric: true,
            cell: (setting) => <span className="mm-data font-semibold">{setting.value}</span>,
        },
        {
            key: 'actions',
            header: '',
            card: 'full',
            cell: (setting) => (
                <Button
                    aria-label={t('settings.editAria', { key: setting.key })}
                    iconOnly
                    onClick={() => setEditing(setting)}
                    size="small"
                    variant="ghost"
                >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
            ),
        },
    ];

    return (
        <div className="grid gap-6">
            <PageHeader
                description={t('settings.description')}
                kicker={t('settings.kicker')}
                title={t('settings.title')}
            />

            {error && (
                <Alert tone="danger" title={t('common.errors.loadTitle')}>
                    <p>{error}</p>
                </Alert>
            )}

            {!error && (
                <SectionCard flush>
                    <DataTable
                        caption={t('settings.tableCaption')}
                        columns={columns}
                        loading={!settings}
                        loadingLabel={t('settings.loading')}
                        minWidth="40rem"
                        rowKey={(setting) => setting.key}
                        rows={settings ?? []}
                        empty={<EmptyState icon={SettingsIcon} title={t('settings.empty')} />}
                    />
                </SectionCard>
            )}

            <SettingFormDialog
                onClose={() => setEditing(undefined)}
                onSubmit={submitEdit}
                open={editing !== undefined}
                setting={editing}
            />
        </div>
    );
}
