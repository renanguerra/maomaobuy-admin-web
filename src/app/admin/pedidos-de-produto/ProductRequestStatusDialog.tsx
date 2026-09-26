'use client';

import { ActionDialog } from '@/components/admin/ActionDialog';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { PRODUCT_REQUEST_STATUSES, type AdminProductRequest } from '@/types/api';

/** Status e nota da decisão — o mesmo diálogo na lista e no detalhe. */
export function ProductRequestStatusDialog({
    request,
    onCancel,
    onUpdated,
}: {
    request: AdminProductRequest | undefined;
    onCancel: () => void;
    onUpdated: (updated: AdminProductRequest) => void;
}) {
    const { t } = useTranslation();

    async function handleConfirm(values: Record<string, string>) {
        if (!request) return;
        try {
            const updated = await api<AdminProductRequest>(`/product-requests/${request.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: values.status,
                    ...(values.adminNote ? { adminNote: values.adminNote } : {}),
                }),
            });
            onUpdated(updated);
        } catch (err) {
            throw err instanceof ApiError ? err : new Error(t('productRequests.actionError'));
        }
    }

    return (
        <ActionDialog
            confirmLabel={t('productRequests.dialog.confirmLabel')}
            description={t('productRequests.dialog.description')}
            fields={[
                {
                    name: 'status',
                    label: t('productRequests.dialog.statusLabel'),
                    kind: 'select',
                    defaultValue: request?.status,
                    options: PRODUCT_REQUEST_STATUSES.map((status) => ({
                        value: status,
                        label: t(`productRequests.dialog.statusOptions.${status}`),
                    })),
                },
                {
                    name: 'adminNote',
                    label: t('productRequests.dialog.noteLabel'),
                    kind: 'textarea',
                    hint: t('productRequests.dialog.noteHint'),
                    optional: true,
                    defaultValue: request?.adminNote ?? '',
                    maxLength: 2000,
                    wide: true,
                },
            ]}
            onCancel={onCancel}
            onConfirm={handleConfirm}
            open={Boolean(request)}
            title={t('productRequests.dialog.title')}
        />
    );
}
