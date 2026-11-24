'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';

const COPIED_MS = 2000;

/** Copia um texto pronto e confirma no próprio botão. */
export function CopyButton({ text, label, disabled }: { text: string; label: string; disabled?: boolean }) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), COPIED_MS);
        return () => clearTimeout(timer);
    }, [copied]);

    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch {
            // Sem permissão ou fora de HTTPS: o navegador recusa a cópia.
            notify({ tone: 'danger', title: t('common.actions.copyError') });
        }
    }

    const Icon = copied ? Check : Copy;

    return (
        <Button
            disabled={disabled}
            leadingIcon={<Icon className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void copy()}
            size="small"
            type="button"
            variant="secondary"
        >
            <span aria-live="polite">{copied ? t('common.actions.copied') : label}</span>
        </Button>
    );
}
