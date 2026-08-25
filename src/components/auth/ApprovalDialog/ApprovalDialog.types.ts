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
     * Algumas ações (editar descrição, anexar/remover mídia) não mexem em
     * dinheiro nem em dados sensíveis, então não exigem TOTP — só motivo.
     * Default `true` para manter o comportamento de toda ação financeira.
     */
    requireTotp?: boolean;
    onCancel: () => void;
    onConfirm: (values: { totpCode: string; reason: string } & Record<string, string>) => Promise<void>;
}
