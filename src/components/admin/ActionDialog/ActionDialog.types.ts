import type { SelectOption } from '@/components/ui/Select';

export type ActionDialogFieldKind = 'text' | 'textarea' | 'number' | 'currency' | 'select';

export interface ActionDialogField {
    name: string;
    label: string;
    /** Padrão: `text`. `currency` guarda o valor já em centavos. */
    kind?: ActionDialogFieldKind;
    placeholder?: string;
    hint?: string;
    /** Padrão: obrigatório. */
    optional?: boolean;
    defaultValue?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    inputMode?: 'text' | 'numeric' | 'decimal';
    min?: number;
    max?: number;
    /** Sufixo fixo à direita (g, mm, BRL). */
    suffix?: string;
    options?: readonly SelectOption[];
    /** Ocupa as duas colunas do formulário. */
    wide?: boolean;
}

export interface ActionDialogProps {
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    variant?: 'primary' | 'danger';
    /** Campos extras da ação, como transportadora e código de rastreio no despacho. */
    fields?: readonly ActionDialogField[];
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
