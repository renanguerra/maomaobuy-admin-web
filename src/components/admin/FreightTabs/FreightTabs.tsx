'use client';

import { RouteTabs } from '@/components/admin/RouteTabs';
import { useTranslation } from '@/i18n/LanguageProvider';

/**
 * Frete é uma tela só no menu, com três assuntos. Cada aba mantém o endereço
 * que já tinha, então link antigo abre a aba certa.
 */
export function FreightTabs() {
    const { t } = useTranslation();
    return (
        <RouteTabs
            label={t('freightTabs.label')}
            tabs={[
                { href: '/admin/frete', label: t('freightTabs.shippingTable') },
                { href: '/admin/embalagens', label: t('freightTabs.shippingBoxes') },
                { href: '/admin/transportadoras', label: t('freightTabs.carriers') },
            ]}
        />
    );
}
