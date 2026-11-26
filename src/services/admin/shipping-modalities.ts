import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import type { ActionDialogField } from '@/components/admin/ActionDialog';
import type { AdminPackage } from '@/types/api';
import { OTHER_RATE_LINE, SHIPPING_CARRIERS, type DispatchOptions } from '@/types/shipping-table';

/**
 * Modalidades cadastradas em Frete. Só busca com `enabled` (diálogo aberto):
 * ver um pacote não precisa delas. Falhou, reabrir o diálogo tenta de novo.
 */
export function useDispatchOptions(enabled: boolean) {
    const [options, setOptions] = useState<DispatchOptions>();
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        let current = true;
        api<DispatchOptions>('/shipping-table/dispatch-options')
            .then((loaded) => {
                if (!current) return;
                setOptions(loaded);
                setFailed(false);
            })
            .catch(() => current && setFailed(true));
        return () => {
            current = false;
        };
    }, [enabled]);

    return { options, failed };
}

/**
 * Campos de despacho do `ActionDialog`. A modalidade é sempre uma das
 * cadastradas; a que o pacote já usa continua na lista mesmo depois de
 * excluída, para corrigir o rastreio sem trocar a modalidade.
 */
export function useDispatchFields(enabled: boolean) {
    const { t } = useTranslation();
    const { options, failed } = useDispatchOptions(enabled);

    function modalityField(
        pkg: AdminPackage,
        { optional = false, westlinkCode }: { optional?: boolean; westlinkCode?: string } = {},
    ): ActionDialogField {
        const modalities = options?.modalities ?? [];
        // A linha consultada na cotação já diz a modalidade provável.
        const quotedLineModality = options?.quoteLines.find((line) => line.id === pkg.freightRateLineId)?.modalityId;
        const currentIsListed = modalities.some((modality) => modality.id === pkg.shippingModalityId);
        const loading = !options && !failed;
        const hint = failed
            ? t('packages.detail.dialogs.dispatch.modalityError')
            : options && modalities.length === 0
              ? t('packages.detail.dialogs.dispatch.modalityEmpty')
              : // Pacote de quando a modalidade era texto livre.
                pkg.carrierService && !pkg.shippingModalityId
                ? t('packages.detail.dialogs.dispatch.modalityPrevious', { name: pkg.carrierService })
                : undefined;
        return {
            name: 'shippingModalityId',
            kind: 'select',
            label: t('packages.detail.dialogs.dispatch.modality'),
            placeholder: loading ? t('common.loading') : t('packages.detail.dialogs.dispatch.modalityPlaceholder'),
            hint,
            optional,
            defaultValue:
                pkg.shippingModalityId ??
                (westlinkCode ? options?.westlinkModalities[westlinkCode] : undefined) ??
                quotedLineModality ??
                '',
            options: [
                ...modalities.map((modality) => ({
                    value: modality.id,
                    label: modality.isActive
                        ? modality.name
                        : t('packages.detail.dialogs.dispatch.modalityInactive', { name: modality.name }),
                })),
                ...(pkg.shippingModalityId && !currentIsListed
                    ? [{ value: pkg.shippingModalityId, label: pkg.carrierService ?? pkg.shippingModalityId }]
                    : []),
            ],
        };
    }

    function carrierField(extra: Partial<ActionDialogField> = {}): ActionDialogField {
        return {
            name: 'carrier',
            label: t('packages.detail.dialogs.dispatch.carrier'),
            placeholder: t('packages.detail.dialogs.dispatch.carrierPlaceholder'),
            suggestions: SHIPPING_CARRIERS,
            minLength: 2,
            maxLength: 120,
            ...extra,
        };
    }

    /**
     * Linha de frete consultada para chegar no custo. Obrigatória: é o que
     * ensina o preço das linhas sob consulta. "Outra" quando nenhuma
     * cadastrada serviu. `channelCode` vem da cotação pela API da Westlink.
     */
    function quoteLineField(pkg: AdminPackage, channelCode?: string): ActionDialogField {
        const country = pkg.destination?.countryCode || 'BR';
        const lines = (options?.quoteLines ?? []).filter(
            (line) => line.destinationCountry === country && (line.isActive || line.id === pkg.freightRateLineId),
        );
        // Código da Westlink só vale para a linha da Westlink: outra linha pode ter o mesmo código.
        const fromApi = channelCode
            ? lines.find((line) => line.integration === 'WESTLINK' && line.code === channelCode)?.id
            : undefined;
        return {
            name: 'freightRateLineId',
            kind: 'select',
            label: t('packages.detail.dialogs.shipment.rateLine'),
            hint: failed
                ? t('packages.detail.dialogs.shipment.rateLineError')
                : t('packages.detail.dialogs.shipment.rateLineHint'),
            placeholder:
                !options && !failed ? t('common.loading') : t('packages.detail.dialogs.shipment.rateLinePlaceholder'),
            defaultValue: fromApi ?? pkg.freightRateLineId ?? '',
            wide: true,
            options: [
                ...lines.map((line) => ({
                    value: line.id,
                    label: `${line.code} · ${line.name}${line.onRequest ? ` (${t('packages.detail.dialogs.shipment.rateLineOnRequest')})` : ''}`,
                })),
                { value: OTHER_RATE_LINE, label: t('packages.detail.dialogs.shipment.rateLineOther') },
            ],
        };
    }

    return { modalityField, carrierField, quoteLineField };
}
