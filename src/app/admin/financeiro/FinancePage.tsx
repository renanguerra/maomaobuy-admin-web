'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ApprovalDialog } from '@/components/auth/ApprovalDialog';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/services/api';
import { formatDate, money, type AdminRefundRequest } from '@/types/api';

type DialogState = { kind: 'approve-refund' | 'reject-refund'; refundId: string } | null;

export function FinancePage() {
    const [refunds, setRefunds] = useState<AdminRefundRequest[]>();
    const [error, setError] = useState<string>();
    const [feedback, setFeedback] = useState<string>();
    const [dialog, setDialog] = useState<DialogState>(null);

    function load() {
        api<AdminRefundRequest[]>('/finance/refunds')
            .then(setRefunds)
            .catch(() => setError('Não foi possível carregar os reembolsos.'));
    }

    useEffect(() => {
        load();
    }, []);

    async function handleRefundConfirm(values: { totpCode: string; reason: string }) {
        if (!dialog) return;
        const action = dialog.kind === 'approve-refund' ? 'approve' : 'reject';
        try {
            await api(`/finance/refunds/${dialog.refundId}/${action}`, {
                method: 'POST',
                body: JSON.stringify(values),
            });
            setDialog(null);
            setFeedback(action === 'approve' ? 'Reembolso aprovado.' : 'Reembolso rejeitado.');
            load();
        } catch (err) {
            throw err instanceof ApiError ? err : new Error('Não foi possível concluir a ação.');
        }
    }

    return (
        <main>
            <p className="mm-kicker mb-3">Financeiro</p>
            <h1 className="m-0 text-3xl tracking-[-.03em]">Financeiro</h1>
            <p className="mt-2 max-w-2xl text-muted dark:text-night-muted">
                Fila de solicitações de reembolso.
            </p>

            {feedback && <p className="mt-4 text-sm text-success">{feedback}</p>}
            {error && <p className="mt-6 border-l-2 border-origin-500 pl-3 text-sm">{error}</p>}

            <section className="mt-8">
                <h2 className="m-0 text-xl">Reembolsos</h2>
                {!refunds && !error && <p className="mt-4 text-muted">Carregando reembolsos…</p>}
                {refunds && (
                    <div className="mt-4 grid gap-3">
                        {refunds.map((refund) => (
                            <div className="mm-panel-soft flex flex-wrap items-center justify-between gap-4 p-4" key={refund.id}>
                                <div>
                                    <strong className="mm-data">{money(refund.netAmountMinor, refund.currency)}</strong>
                                    <p className="mt-0.5 text-sm text-muted dark:text-night-muted">
                                        Usuário {refund.userId.slice(0, 8)} · {formatDate(refund.createdAt)}
                                    </p>
                                    <p className="mt-1 text-sm">{refund.reason}</p>
                                    <p className="mt-1">
                                        <span className="mm-kicker">{refund.status}</span>
                                    </p>
                                </div>
                                {refund.status === 'REQUESTED' && (
                                    <div className="flex gap-2">
                                        <Button
                                            size="small"
                                            variant="primary"
                                            onClick={() => setDialog({ kind: 'approve-refund', refundId: refund.id })}
                                            leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                                        >
                                            Aprovar
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="danger"
                                            onClick={() => setDialog({ kind: 'reject-refund', refundId: refund.id })}
                                            leadingIcon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                                        >
                                            Rejeitar
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {refunds.length === 0 && <p className="text-sm text-muted dark:text-night-muted">Nenhum reembolso solicitado.</p>}
                    </div>
                )}
            </section>

            <ApprovalDialog
                open={dialog?.kind === 'approve-refund'}
                title="Aprovar reembolso"
                description="O valor será alocado de volta aos pagamentos originais."
                confirmLabel="Aprovar"
                onCancel={() => setDialog(null)}
                onConfirm={handleRefundConfirm}
            />
            <ApprovalDialog
                open={dialog?.kind === 'reject-refund'}
                title="Rejeitar reembolso"
                description="O saldo reservado será liberado de volta para a carteira do usuário."
                confirmLabel="Rejeitar"
                variant="danger"
                onCancel={() => setDialog(null)}
                onConfirm={handleRefundConfirm}
            />
        </main>
    );
}
