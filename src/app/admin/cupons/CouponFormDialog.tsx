'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog';
import { Alert } from '@/components/admin/Alert';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import type { AdminProduct, AdminUser, Coupon, CouponDiscountType, CouponScope, Page } from '@/types/api';
import { basisPointsFromPercent, fromDateTimeLocal, percentFromBasisPoints, toDateTimeLocal } from './coupon-format';

const FORM_ID = 'coupon-form';

/** O corpo que o backend espera; `null` limpa um campo opcional na edição. */
export interface CouponFormValues {
    code: string;
    name: string;
    description: string | null;
    scope: CouponScope;
    /** Ausentes no cupom de brinde, que não desconta. */
    discountType?: CouponDiscountType;
    discountValue?: string;
    maxDiscountMinor?: string | null;
    /** Só no cupom de brinde, e só na criação: o brinde não muda depois. */
    giftProductId?: string;
    giftVariantExternalId?: string;
    minAmountMinor: string | null;
    maxUses: number | null;
    maxUsesPerUser: number;
    startsAt: string | null;
    expiresAt: string | null;
    userId: string | null;
    isActive: boolean;
    totpCode: string;
}

interface CouponFormDialogProps {
    open: boolean;
    /** Ausente = criação. Presente = edição; código, escopo e tipo ficam travados. */
    coupon?: Coupon;
    onClose: () => void;
    onSubmit: (values: CouponFormValues) => Promise<void>;
}

/**
 * Cupom é desconto, logo dinheiro: o formulário pede TOTP como toda ação
 * sensível do painel. Código, escopo e tipo só existem na criação — pedidos
 * pagos guardam o código, e trocar o que ele significava confundiria a
 * leitura deles.
 */
export function CouponFormDialog({ open, coupon, onClose, onSubmit }: CouponFormDialogProps) {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const needsEnrollment = useTotpEnrollmentGate(open, true);

    if (needsEnrollment) {
        return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;
    }

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            onClose={onClose}
            open={open}
            size="medium"
            title={coupon ? t('coupons.form.editTitle', { code: coupon.code }) : t('coupons.form.createTitle')}
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button form={FORM_ID} loading={submitting} type="submit">
                        {t('common.actions.save')}
                    </Button>
                </>
            }
        >
            {open && <CouponForm coupon={coupon} onSubmit={onSubmit} onSubmittingChange={setSubmitting} />}
        </Modal>
    );
}

type Target = 'open' | 'user';

function CouponForm({
    coupon,
    onSubmit,
    onSubmittingChange,
}: {
    coupon?: Coupon;
    onSubmit: (values: CouponFormValues) => Promise<void>;
    onSubmittingChange: (submitting: boolean) => void;
}) {
    const { t } = useTranslation();
    const [scope, setScope] = useState<CouponScope>(coupon?.scope ?? 'ORDER');
    const [discountType, setDiscountType] = useState<CouponDiscountType>(coupon?.discountType ?? 'PERCENTAGE');
    const [percent, setPercent] = useState(
        coupon?.discountType === 'PERCENTAGE' && coupon.discountValue
            ? percentFromBasisPoints(coupon.discountValue)
            : '10',
    );
    const [amount, setAmount] = useState(
        coupon?.discountType === 'FIXED' && coupon.discountValue ? coupon.discountValue : '0',
    );
    const [maxDiscount, setMaxDiscount] = useState(coupon?.maxDiscountMinor ?? '');
    const [minAmount, setMinAmount] = useState(coupon?.minAmountMinor ?? '');
    const [target, setTarget] = useState<Target>(coupon?.user ? 'user' : 'open');
    const [user, setUser] = useState<Coupon['user']>(coupon?.user ?? null);
    const [isActive, setIsActive] = useState(coupon?.isActive ?? true);
    const [gift, setGift] = useState<GiftSelection | null>(null);
    const [error, setError] = useState<string>();
    const isGift = scope === 'GIFT';

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const maxUses = String(data.get('maxUses') ?? '').trim();

        if (target === 'user' && !user) {
            setError(t('coupons.form.userRequired'));
            return;
        }
        if (isGift && !coupon && !gift) {
            setError(t('coupons.form.giftRequired'));
            return;
        }
        if (isGift && !coupon && gift && gift.variants.length > 0 && !gift.variantExternalId) {
            setError(t('coupons.form.giftVariantRequired'));
            return;
        }

        onSubmittingChange(true);
        setError(undefined);
        try {
            await onSubmit({
                code: String(data.get('code') ?? '').trim(),
                name: String(data.get('name') ?? '').trim(),
                description: String(data.get('description') ?? '').trim() || null,
                scope,
                // O brinde não desconta: os campos de desconto nem vão.
                ...(isGift
                    ? coupon
                        ? {}
                        : {
                              giftProductId: gift?.productId,
                              giftVariantExternalId: gift?.variantExternalId || undefined,
                          }
                    : {
                          discountType,
                          discountValue:
                              discountType === 'PERCENTAGE' ? String(basisPointsFromPercent(percent)) : amount,
                          // Vazio ou zero é "sem": o backend guarda nulo, não zero.
                          maxDiscountMinor:
                              discountType === 'PERCENTAGE' && maxDiscount && maxDiscount !== '0' ? maxDiscount : null,
                      }),
                minAmountMinor: minAmount && minAmount !== '0' ? minAmount : null,
                maxUses: maxUses ? Number(maxUses) : null,
                maxUsesPerUser: Number(String(data.get('maxUsesPerUser') ?? '1') || 1),
                startsAt: fromDateTimeLocal(String(data.get('startsAt') ?? '')),
                expiresAt: fromDateTimeLocal(String(data.get('expiresAt') ?? '')),
                userId: target === 'user' ? (user?.id ?? null) : null,
                isActive,
                totpCode: String(data.get('totpCode') ?? ''),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('coupons.actionError'));
        } finally {
            onSubmittingChange(false);
        }
    }

    return (
        <form className="grid gap-4 sm:grid-cols-2" id={FORM_ID} onSubmit={handleSubmit}>
            <Input
                className="mm-data uppercase"
                defaultValue={coupon?.code}
                disabled={Boolean(coupon)}
                hint={coupon ? undefined : t('coupons.form.codeHint')}
                label={t('coupons.form.code')}
                maxLength={40}
                name="code"
                pattern="[A-Za-z0-9_\-]{2,40}"
                required
            />
            <Input
                defaultValue={coupon?.name}
                hint={t('coupons.form.nameHint')}
                label={t('coupons.form.name')}
                maxLength={120}
                name="name"
                required
            />

            <Textarea
                className="sm:col-span-2"
                defaultValue={coupon?.description ?? ''}
                hint={t('coupons.form.descriptionHint')}
                label={t('coupons.form.description')}
                maxLength={300}
                name="description"
                rows={2}
            />

            <Select
                disabled={Boolean(coupon)}
                hint={t(`coupons.scopeHints.${scope}`)}
                label={t('coupons.form.scope')}
                onChange={(event) => setScope(event.target.value as CouponScope)}
                options={[
                    { value: 'ORDER', label: t('coupons.scopes.ORDER') },
                    { value: 'SHIPPING', label: t('coupons.scopes.SHIPPING') },
                    { value: 'GIFT', label: t('coupons.scopes.GIFT') },
                ]}
                value={scope}
            />
            {isGift ? (
                <div className="sm:col-span-2">
                    {coupon ? (
                        <p className="m-0 text-sm text-ink dark:text-night-text">
                            <span className="block text-xs text-muted dark:text-night-muted">
                                {t('coupons.form.gift')}
                            </span>
                            <strong>{coupon.gift?.productName}</strong>
                            <span className="mt-1 block text-xs text-muted dark:text-night-muted">
                                {t('coupons.form.giftFixedHint')}
                            </span>
                        </p>
                    ) : (
                        <GiftPicker onChange={setGift} value={gift} />
                    )}
                </div>
            ) : (
                <>
                    <Select
                        disabled={Boolean(coupon)}
                        hint={coupon ? t('coupons.form.fixedFieldsHint') : undefined}
                        label={t('coupons.form.discountType')}
                        onChange={(event) => setDiscountType(event.target.value as CouponDiscountType)}
                        options={[
                            { value: 'PERCENTAGE', label: t('coupons.discountTypes.PERCENTAGE') },
                            { value: 'FIXED', label: t('coupons.discountTypes.FIXED') },
                        ]}
                        value={discountType}
                    />

                    {discountType === 'PERCENTAGE' ? (
                        <>
                            <Input
                                hint={t('coupons.form.percentHint')}
                                inputMode="decimal"
                                label={t('coupons.form.percent')}
                                max={100}
                                min={0.01}
                                onChange={(event) => setPercent(event.target.value)}
                                required
                                step={0.01}
                                type="number"
                                value={percent}
                            />
                            <CurrencyInput
                                currency="CNY"
                                hint={t('coupons.form.maxDiscountHint')}
                                label={t('coupons.form.maxDiscount')}
                                minor={maxDiscount}
                                onMinorChange={setMaxDiscount}
                            />
                        </>
                    ) : (
                        <CurrencyInput
                            className="sm:col-span-2"
                            currency="CNY"
                            label={t('coupons.form.amount')}
                            minor={amount}
                            onMinorChange={setAmount}
                            required
                        />
                    )}
                </>
            )}

            <CurrencyInput
                currency="CNY"
                hint={t('coupons.form.minAmountHint')}
                label={t('coupons.form.minAmount')}
                minor={minAmount}
                onMinorChange={setMinAmount}
            />
            <Input
                defaultValue={coupon?.maxUses ?? ''}
                hint={t('coupons.form.maxUsesHint')}
                inputMode="numeric"
                label={t('coupons.form.maxUses')}
                min={1}
                name="maxUses"
                type="number"
            />

            <Input
                defaultValue={coupon?.maxUsesPerUser ?? 1}
                inputMode="numeric"
                label={t('coupons.form.maxUsesPerUser')}
                min={1}
                name="maxUsesPerUser"
                required
                type="number"
            />
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                <Input
                    defaultValue={toDateTimeLocal(coupon?.startsAt ?? null)}
                    label={t('coupons.form.startsAt')}
                    name="startsAt"
                    type="datetime-local"
                />
                <Input
                    defaultValue={toDateTimeLocal(coupon?.expiresAt ?? null)}
                    label={t('coupons.form.expiresAt')}
                    name="expiresAt"
                    type="datetime-local"
                />
            </div>

            <div className="grid gap-3 sm:col-span-2">
                <Select
                    label={t('coupons.form.target')}
                    onChange={(event) => setTarget(event.target.value as Target)}
                    options={[
                        { value: 'open', label: t('coupons.form.targetOpen') },
                        { value: 'user', label: t('coupons.form.targetUser') },
                    ]}
                    value={target}
                />
                {target === 'user' && <UserPicker onChange={setUser} value={user} />}
            </div>

            <Checkbox
                checked={isActive}
                className="sm:col-span-2"
                label={t('coupons.form.isActive')}
                onChange={(event) => setIsActive(event.target.checked)}
            />

            <Input
                autoComplete="one-time-code"
                inputMode="numeric"
                label={t('common.fields.totpCode')}
                maxLength={6}
                name="totpCode"
                pattern="\d{6}"
                required
            />

            {error && (
                <Alert className="sm:col-span-2" tone="danger">
                    <p>{error}</p>
                </Alert>
            )}
        </form>
    );
}

/**
 * Escolha do cliente pela mesma busca da lista de usuários (nome, usuário
 * ou e-mail). Guarda só id, nome e e-mail: é o que a lista de cupons mostra.
 */
function UserPicker({ value, onChange }: { value: Coupon['user']; onChange: (user: Coupon['user']) => void }) {
    const { t } = useTranslation();
    const [term, setTerm] = useState('');
    // Resultados guardados com o termo que os produziu: enquanto não
    // baterem com o termo atual, a busca está em andamento.
    const [found, setFound] = useState<{ term: string; users: AdminUser[] }>();
    const searching = term.trim().length >= 2;
    const results = found?.term === term.trim() ? found.users : undefined;

    useEffect(() => {
        if (!searching) return;
        let active = true;
        const current = term.trim();
        const query = new URLSearchParams({ search: current, limit: '8' });
        api<Page<AdminUser>>(`/users?${query.toString()}`)
            .then((page) => {
                if (active) setFound({ term: current, users: page.data });
            })
            .catch(() => {
                if (active) setFound({ term: current, users: [] });
            });
        return () => {
            active = false;
        };
    }, [term, searching]);

    if (value) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-warm-50 px-3 py-2 dark:border-night-line dark:bg-night-raised">
                <span className="min-w-0">
                    <span className="block text-xs text-muted dark:text-night-muted">
                        {t('coupons.form.userSelected')}
                    </span>
                    <span className="block truncate text-sm font-semibold text-ink dark:text-night-text">
                        {value.name}
                    </span>
                    <span className="block truncate text-xs text-muted dark:text-night-muted">{value.email}</span>
                </span>
                <Button onClick={() => onChange(null)} size="small" type="button" variant="ghost">
                    {t('coupons.form.userChange')}
                </Button>
            </div>
        );
    }

    return (
        <div className="grid gap-2">
            <SearchInput
                clearLabel={t('common.actions.clearSearch')}
                delay={250}
                label={t('coupons.form.userSearch')}
                onChange={setTerm}
                placeholder={t('coupons.form.userSearchPlaceholder')}
                value={term}
            />
            {searching && (
                <ul className="m-0 grid max-h-56 list-none gap-1 overflow-y-auto p-0">
                    {results === undefined ? (
                        <li className="px-2 py-1.5 text-xs text-muted dark:text-night-muted">
                            {t('coupons.form.userSearching')}
                        </li>
                    ) : results.length === 0 ? (
                        <li className="px-2 py-1.5 text-xs text-muted dark:text-night-muted">
                            {t('coupons.form.userNone')}
                        </li>
                    ) : (
                        results.map((candidate) => (
                            <li key={candidate.id}>
                                <button
                                    className="flex w-full flex-col rounded-md px-2 py-1.5 text-left transition hover:bg-brand-50 dark:hover:bg-night-brand-hover"
                                    onClick={() =>
                                        onChange({ id: candidate.id, name: candidate.name, email: candidate.email })
                                    }
                                    type="button"
                                >
                                    <span className="text-sm font-semibold text-ink dark:text-night-text">
                                        {candidate.name}
                                    </span>
                                    <span className="text-xs text-muted dark:text-night-muted">{candidate.email}</span>
                                </button>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}

export interface GiftSelection {
    productId: string;
    productName: string;
    variants: { externalId: string; label: string }[];
    variantExternalId: string;
}

/**
 * Escolha do brinde: busca só entre os produtos da CoinShop. Produto com
 * variações pede qual delas vai — o cupom guarda uma só.
 */
export function GiftPicker({
    value,
    onChange,
}: {
    value: GiftSelection | null;
    onChange: (gift: GiftSelection | null) => void;
}) {
    const { t } = useTranslation();
    const [term, setTerm] = useState('');
    const [found, setFound] = useState<{ term: string; products: AdminProduct[] }>();
    const current = term.trim();
    const results = found?.term === current ? found.products : undefined;

    useEffect(() => {
        let active = true;
        const query = new URLSearchParams({ kind: 'COIN_SHOP', limit: '8' });
        if (current) query.set('search', current);
        api<Page<AdminProduct>>(`/products?${query.toString()}`)
            .then((page) => {
                if (active) setFound({ term: current, products: page.data });
            })
            .catch(() => {
                if (active) setFound({ term: current, products: [] });
            });
        return () => {
            active = false;
        };
    }, [current]);

    if (value) {
        return (
            <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-warm-50 px-3 py-2 dark:border-night-line dark:bg-night-raised">
                    <span className="min-w-0">
                        <span className="block text-xs text-muted dark:text-night-muted">{t('coupons.form.gift')}</span>
                        <span className="block truncate text-sm font-semibold text-ink dark:text-night-text">
                            {value.productName}
                        </span>
                    </span>
                    <Button onClick={() => onChange(null)} size="small" type="button" variant="ghost">
                        {t('coupons.form.userChange')}
                    </Button>
                </div>
                {value.variants.length > 0 && (
                    <Select
                        label={t('coupons.form.giftVariant')}
                        onChange={(event) => onChange({ ...value, variantExternalId: event.target.value })}
                        options={value.variants.map((variant) => ({ value: variant.externalId, label: variant.label }))}
                        placeholderOption={t('coupons.form.giftVariantPlaceholder')}
                        required
                        value={value.variantExternalId}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="grid gap-2">
            <SearchInput
                clearLabel={t('common.actions.clearSearch')}
                delay={250}
                label={t('coupons.form.giftSearch')}
                onChange={setTerm}
                placeholder={t('coupons.form.giftSearchPlaceholder')}
                value={term}
            />
            <ul className="m-0 grid max-h-56 list-none gap-1 overflow-y-auto p-0">
                {results === undefined ? (
                    <li className="px-2 py-1.5 text-xs text-muted dark:text-night-muted">
                        {t('coupons.form.userSearching')}
                    </li>
                ) : results.length === 0 ? (
                    <li className="px-2 py-1.5 text-xs text-muted dark:text-night-muted">
                        {t('coupons.form.giftNone')}
                    </li>
                ) : (
                    results.map((product) => (
                        <li key={product.id}>
                            <button
                                className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-brand-50 dark:hover:bg-night-brand-hover"
                                onClick={() =>
                                    onChange({
                                        productId: product.id,
                                        productName: product.name,
                                        variants: product.variants.map((variant) => ({
                                            externalId: variant.externalId,
                                            label: variant.label,
                                        })),
                                        variantExternalId: '',
                                    })
                                }
                                type="button"
                            >
                                <span className="text-sm font-semibold text-ink dark:text-night-text">
                                    {product.name}
                                </span>
                                <span className="mm-data shrink-0 text-xs text-muted dark:text-night-muted">
                                    {t('coupons.form.giftStock', { count: product.stock })}
                                </span>
                            </button>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}
