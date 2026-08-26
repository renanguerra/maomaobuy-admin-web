'use client';

import { useRef, useState } from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';
import type { AdminPaymentAttachment, PresignedUpload } from '@/types/api';

interface PaymentAttachmentsManagerProps {
    resource: 'orders' | 'packages';
    resourceId: string;
    attachments: AdminPaymentAttachment[];
    onChanged: () => void;
    /** Esconde os controles de enviar/remover quando o pedido/pacote já está concluído ou cancelado. */
    canManage?: boolean;
}

/**
 * Documentos de pagamento (boleto, QR do Pix) anexados pelo admin, e
 * comprovantes enviados pelo cliente. Reaproveita o mesmo fluxo de upload
 * pré-assinado de `OrderMediaManager`/`ProductMediaManager`, mas aceita PDF
 * além de imagem — e o admin pode remover qualquer um dos dois (sempre com
 * motivo, registrado no histórico quando disponível).
 */
export function PaymentAttachmentsManager({
    resource,
    resourceId,
    attachments,
    onChanged,
    canManage = true,
}: PaymentAttachmentsManagerProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string>();
    const [busyId, setBusyId] = useState<string>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const basePath = `/${resource}/${resourceId}/payment-attachments`;
    const adminAttachments = attachments.filter((item) => item.uploadedBy === 'ADMIN');
    const customerAttachments = attachments.filter((item) => item.uploadedBy === 'USER');

    async function uploadOne(file: File, reason: string) {
        const presigned = await api<PresignedUpload>(`${basePath}/upload-url`, {
            method: 'POST',
            body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
        });
        const uploadResponse = await fetch(presigned.uploadUrl, {
            method: 'PUT',
            headers: presigned.headers,
            body: file,
        });
        if (!uploadResponse.ok) throw new Error(`Falha ao enviar "${file.name}" para o armazenamento.`);
        await api(basePath, {
            method: 'POST',
            body: JSON.stringify({ key: presigned.key, mimeType: file.type, sizeBytes: file.size, reason }),
        });
    }

    async function handleFiles(files: FileList) {
        const reason = window.prompt('Motivo do envio (fica registrado no histórico):');
        if (!reason || reason.trim().length < 5) {
            if (reason !== null) setError('Informe um motivo com pelo menos 5 caracteres.');
            return;
        }
        setUploading(true);
        setError(undefined);
        try {
            for (const file of Array.from(files)) {
                await uploadOne(file, reason.trim());
            }
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível enviar o documento.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function remove(attachmentId: string) {
        const reason = window.prompt('Motivo da remoção:');
        if (!reason || reason.trim().length < 5) {
            if (reason !== null) setError('Informe um motivo com pelo menos 5 caracteres.');
            return;
        }
        setBusyId(attachmentId);
        setError(undefined);
        try {
            await api(`${basePath}/${attachmentId}`, {
                method: 'DELETE',
                body: JSON.stringify({ reason: reason.trim() }),
            });
            onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível remover o anexo.');
        } finally {
            setBusyId(undefined);
        }
    }

    function renderTile(item: AdminPaymentAttachment) {
        const isImage = item.mimeType.startsWith('image/');
        return (
            <div className="mm-panel-soft overflow-hidden" key={item.id}>
                {isImage && item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="aspect-square w-full object-cover" src={item.url} alt="" />
                    </a>
                ) : (
                    <a
                        className="grid aspect-square w-full place-items-center gap-2 bg-warm-200 text-xs text-muted dark:bg-night-raised dark:text-night-muted"
                        href={item.url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <FileText className="h-6 w-6" aria-hidden="true" />
                        PDF
                    </a>
                )}
                {canManage && (
                    <div className="p-3">
                        <Button
                            className="w-full text-origin-700"
                            size="small"
                            variant="ghost"
                            onClick={() => remove(item.id)}
                            loading={busyId === item.id}
                        >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Remover
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="m-0 text-lg">Pagamento</h2>
                    <p className="mt-1 text-xs text-muted dark:text-night-muted">
                        Documentos de pagamento (boleto, QR do Pix) e comprovantes enviados pelo cliente.
                    </p>
                </div>
                {canManage && (
                    <label>
                        <input
                            ref={fileInputRef}
                            className="hidden"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            multiple
                            onChange={(event) => {
                                if (event.target.files && event.target.files.length > 0) void handleFiles(event.target.files);
                            }}
                        />
                        <Button
                            size="small"
                            variant="ghost"
                            type="button"
                            loading={uploading}
                            leadingIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {uploading ? 'Enviando…' : 'Anexar documento'}
                        </Button>
                    </label>
                )}
            </div>

            {error && <p className="mt-3 text-sm text-secondary">{error}</p>}

            <div className="mt-4">
                <h3 className="m-0 text-sm font-semibold text-muted dark:text-night-muted">
                    Documentos para pagamento
                </h3>
                <div className="mt-2 grid grid-cols-4 gap-4 max-[800px]:grid-cols-2 max-[460px]:grid-cols-1">
                    {adminAttachments.map(renderTile)}
                    {adminAttachments.length === 0 && (
                        <p className="text-sm text-muted dark:text-night-muted">Nenhum documento enviado ainda.</p>
                    )}
                </div>
            </div>

            <div className="mt-6">
                <h3 className="m-0 text-sm font-semibold text-muted dark:text-night-muted">
                    Comprovantes enviados pelo cliente
                </h3>
                <div className="mt-2 grid grid-cols-4 gap-4 max-[800px]:grid-cols-2 max-[460px]:grid-cols-1">
                    {customerAttachments.map(renderTile)}
                    {customerAttachments.length === 0 && (
                        <p className="text-sm text-muted dark:text-night-muted">Nenhum comprovante enviado ainda.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
