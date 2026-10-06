'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { CostPreset } from '@/types/api';

/** Itens prontos (caixa, fita...) para lançar com um clique. */
export function useCostPresets(enabled: boolean, version = 0) {
    const [presets, setPresets] = useState<CostPreset[]>([]);
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        api<CostPreset[]>('/costs/presets?includeInactive=true')
            .then((result) => {
                if (active) setPresets(result);
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [enabled, version]);
    return presets;
}
