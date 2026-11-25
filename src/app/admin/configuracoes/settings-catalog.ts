import type { MessageKey } from '@/i18n/translations';

/**
 * Como cada configuração aparece para a equipe: assunto, nome e unidade. A
 * fonte do valor continua sendo o banco — chave que não está aqui aparece do
 * mesmo jeito, com o nome técnico, no assunto que o prefixo indicar.
 */
export const SETTING_GROUPS = [
    'exchange',
    'payment',
    'storageFreight',
    'deadlines',
    'coins',
    'influencers',
    'wholesale',
    'other',
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

/** `percent`: pontos-base; `multiplier`: 10000 = 1×; `cny`/`brl`: unidade menor. */
export type SettingUnit = 'percent' | 'multiplier' | 'cny' | 'brl' | 'days' | 'minutes' | 'seconds' | 'grams';

const KNOWN = {
    cny_to_brl_rate: { group: 'exchange' },
    fx_spread_basis_points: { group: 'exchange', unit: 'percent' },
    remittance_fee_basis_points: { group: 'exchange', unit: 'percent' },
    remittance_iof_basis_points: { group: 'exchange', unit: 'percent' },
    psp_pix_fee_basis_points: { group: 'payment', unit: 'percent' },
    psp_pix_fee_fixed_minor: { group: 'payment', unit: 'brl' },
    psp_card_fee_basis_points: { group: 'payment', unit: 'percent' },
    psp_card_fee_fixed_minor: { group: 'payment', unit: 'brl' },
    topup_card_max_installments: { group: 'payment' },
    topup_card_min_installment_minor: { group: 'payment', unit: 'brl' },
    topup_card_max_credit_cny_minor: { group: 'payment', unit: 'cny' },
    topup_min_credit_cny_minor: { group: 'payment', unit: 'cny' },
    wallet_topup_max_credit_cny_minor: { group: 'payment', unit: 'cny' },
    wallet_max_balance_cny_minor: { group: 'payment', unit: 'cny' },
    wallet_refund_fee_basis_points: { group: 'payment', unit: 'percent' },
    storage_free_days: { group: 'storageFreight', unit: 'days' },
    storage_fee_cny_minor_per_month: { group: 'storageFreight', unit: 'cny' },
    shipping_markup_basis_points: { group: 'storageFreight', unit: 'percent' },
    order_stock_reservation_minutes: { group: 'deadlines', unit: 'minutes' },
    stock_reservation_warning_minutes: { group: 'deadlines', unit: 'minutes' },
    freight_payment_reminder_days: { group: 'deadlines', unit: 'days' },
    stored_items_reminder_days: { group: 'deadlines', unit: 'days' },
    storage_ending_reminder_days: { group: 'deadlines', unit: 'days' },
    topup_quote_validity_seconds: { group: 'deadlines', unit: 'seconds' },
    purchase_quote_validity_minutes: { group: 'deadlines', unit: 'minutes' },
    coins_per_cny_basis_points: { group: 'coins', unit: 'multiplier' },
    checkout_addon_coin_multiplier_basis_points: { group: 'coins', unit: 'multiplier' },
    checkout_addon_max_weight_grams: { group: 'coins', unit: 'grams' },
    referral_reward_coins: { group: 'coins' },
    referral_daily_limit: { group: 'coins' },
    referral_monthly_limit: { group: 'coins' },
    influencer_discount_basis_points: { group: 'influencers', unit: 'percent' },
    influencer_commission_basis_points: { group: 'influencers', unit: 'percent' },
    influencer_coupon_max_uses_per_user: { group: 'influencers' },
    wholesale_coin_redeem_grace_days: { group: 'wholesale', unit: 'days' },
    wholesale_coin_reminder_days_before: { group: 'wholesale', unit: 'days' },
    user_address_limit: { group: 'other' },
} as const satisfies Record<string, { group: SettingGroup; unit?: SettingUnit }>;

export type KnownSettingKey = keyof typeof KNOWN;
export const KNOWN_SETTING_KEYS = Object.keys(KNOWN) as KnownSettingKey[];

const GROUP_BY_PREFIX: readonly (readonly [string, SettingGroup])[] = [
    ['remittance_', 'exchange'],
    ['fx_', 'exchange'],
    ['psp_', 'payment'],
    ['topup_', 'payment'],
    ['wallet_', 'payment'],
    ['storage_', 'storageFreight'],
    ['shipping_', 'storageFreight'],
    ['coin', 'coins'],
    ['referral_', 'coins'],
    ['checkout_addon_', 'coins'],
    ['influencer_', 'influencers'],
    ['wholesale_', 'wholesale'],
];

const CARD_INSTALLMENTS = /^psp_card_fee_basis_points_(\d+)x$/;

function isKnown(key: string): key is KnownSettingKey {
    return Object.prototype.hasOwnProperty.call(KNOWN, key);
}

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export interface SettingDescriptor {
    group: SettingGroup;
    unit?: SettingUnit;
    /** Nome para a equipe; a própria chave quando ninguém deu nome a ela. */
    name: string;
    /** Parcelas do cartão: ordena 2x antes de 10x. */
    order: number;
}

export function describeSetting(key: string, t: Translate): SettingDescriptor {
    if (isKnown(key)) {
        const known: { group: SettingGroup; unit?: SettingUnit } = KNOWN[key];
        return { ...known, name: t(`settings.names.${key}`), order: KNOWN_SETTING_KEYS.indexOf(key) };
    }
    const installments = CARD_INSTALLMENTS.exec(key)?.[1];
    if (installments)
        return {
            group: 'payment',
            unit: 'percent',
            name: t('settings.cardInstallmentsName', { count: installments }),
            // Logo depois da taxa à vista.
            order: KNOWN_SETTING_KEYS.indexOf('psp_card_fee_basis_points') + Number(installments) / 100,
        };
    return {
        group: GROUP_BY_PREFIX.find(([prefix]) => key.startsWith(prefix))?.[1] ?? 'other',
        name: key,
        order: KNOWN_SETTING_KEYS.length,
    };
}

/** Valor na unidade que a pessoa usa (800 → 8%). Nulo quando o número já é o valor. */
export function friendlySettingValue(
    value: string,
    unit: SettingUnit | undefined,
    locale: string,
    t: Translate,
): string | null {
    const number = Number(value);
    if (!unit || !Number.isFinite(number)) return null;
    const format = (amount: number, digits = 2) =>
        new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(amount);
    switch (unit) {
        case 'percent':
            return `${format(number / 100)}%`;
        case 'multiplier':
            return `${format(number / 10_000)}×`;
        case 'cny':
            return `¥ ${format(number / 100)}`;
        case 'brl':
            return `R$ ${format(number / 100)}`;
        default:
            return t(`settings.units.${unit}`, { count: format(number, 0) });
    }
}
