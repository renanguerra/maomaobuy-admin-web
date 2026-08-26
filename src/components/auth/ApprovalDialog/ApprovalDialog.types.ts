export interface ApprovalDialogField {
    name: string;
    label: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    /** Restrição adicional de formato, ex. dígitos apenas. */
    pattern?: string;
    inputMode?: 'text' | 'numeric' | 'decimal';
    /** Renderiza um `<textarea>` em vez de `<input>`, para textos longos. */
    multiline?: boolean;
}

export interface ApprovalDialogProps {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    variant?: 'primary' | 'danger';
    /** Campos extras coletados antes do TOTP, como carrier/trackingCode no despacho. */
    fields?: ApprovalDialogField[];
    /**
     * TOTP temporariamente não exigido em nenhuma rota admin (ver AGENTS.md
     * do backend) — default `false`. Prop mantida para religar por ação
     * específica, ou trocando o default aqui, quando a exigência voltar.
     */
    requireTotp?: boolean;
    /**
     * Motivo só é obrigatório em bloqueio de usuário e rejeição de pedido/
     * pacote (ver AGENTS.md do backend) — default `false`. Passe `true`
     * explicitamente nessas três ações; as demais viram confirmação simples.
     */
    requireReason?: boolean;
    onCancel: () => void;
    onConfirm: (values: { totpCode: string; reason: string } & Record<string, string>) => Promise<void>;
}
