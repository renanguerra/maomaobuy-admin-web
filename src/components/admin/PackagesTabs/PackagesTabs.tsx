'use client';

import { RouteTabs } from '@/components/admin/RouteTabs';
import { useTranslation } from '@/i18n/LanguageProvider';

/** Pacotes e "Sem pacote" (o que está no armazém sem pacote): um item no menu. */
export function PackagesTabs() {
    const { t } = useTranslation();
    return (
        <RouteTabs
            label={t('packagesTabs.label')}
            tabs={[
                { href: '/admin/pacotes', label: t('packagesTabs.packages') },
                { href: '/admin/sem-pacote', label: t('packagesTabs.unpacked') },
            ]}
        />
    );
}
