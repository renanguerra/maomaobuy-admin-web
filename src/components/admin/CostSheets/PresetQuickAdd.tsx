'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { money, type CostPreset } from '@/types/api';
import type { CostTarget } from './CostEntryDialog';
import { todayIso } from './cost-utils';

/**
 * Embalagens e brindes cadastrados como botões: "+ Caixa 43×21×27" lança na
 * hora, preso ao pedido ou à caixa, sem abrir formulário. Serve para o que
 * não é automático ou para uma unidade a mais do que é.
 */
export function PresetQuickAdd({
    presets,
    target,
    onAdded,
}: {
    presets: readonly CostPreset[];
    target: CostTarget;
    onAdded: () => void;
}) {
    const { t } = useTranslation();
    const { notify } = useToast();
    const [adding, setAdding] = useState<string>();
    const active = presets.filter((preset) => preset.isActive);
    if (active.length === 0) return null;

    async function add(preset: CostPreset) {
        setAdding(preset.id);
        try {
            await api('/costs/entries', {
                method: 'POST',
                body: JSON.stringify({
                    category: preset.category,
                    description: preset.name,
                    quantity: 1,
                    unitAmountMinor: preset.unitAmountMinor,
                    currency: preset.currency,
                    incurredOn: todayIso(),
                    ...target,
                }),
            });
            notify({ tone: 'success', title: t('profit.sheet.presetAdded', { name: preset.name }) });
            onAdded();
        } catch (err) {
            notify({ tone: 'danger', title: err instanceof ApiError ? err.message : t('common.errors.generic') });
        } finally {
            setAdding(undefined);
        }
    }

    return (
        <div className="mb-3 flex flex-wrap gap-2">
            {active.map((preset) => (
                <Button
                    disabled={adding !== undefined}
                    key={preset.id}
                    loading={adding === preset.id}
                    onClick={() => void add(preset)}
                    size="small"
                    variant="ghost"
                >
                    + {preset.name} · {money(preset.unitAmountMinor, preset.currency)}
                </Button>
            ))}
        </div>
    );
}
