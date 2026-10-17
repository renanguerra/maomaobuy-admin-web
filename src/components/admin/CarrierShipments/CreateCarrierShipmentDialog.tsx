'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { useTotpEnrollmentGate } from '@/components/admin/ActionDialog/ActionDialog';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { TotpEnrollmentDialog } from '@/components/admin/TotpEnrollmentDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny } from '@/types/api';
import {
    usd,
    type CarrierChannel,
    type CarrierChannels,
    type CarrierConsignee,
    type CarrierDraft,
    type CarrierDraftItem,
    type CarrierRefresh,
} from '@/types/carrier';
import { CarrierChannelBadges, CarrierChannelDetails } from './CarrierChannelDetails';

const FORM_ID = 'create-carrier-shipment-form';

interface CreateCarrierShipmentDialogProps {
    packageId: string;
    /** Linha escolhida na cotação, se houve; senão a preferida (BR025). */
    initialChannelCode?: string;
    onClose: () => void;
    onCreated: (result: CarrierRefresh) => void;
}

interface ItemForm {
    englishName: string;
    chineseName: string;
    hsCode: string;
    unitNetWeightGrams: string;
    /** Em dólares, como o admin digita ("12.50"). */
    unitDeclaredUsd: string;
}

/**
 * Cria o pré-aviso na Westlink. Tudo vem preenchido do pacote: o admin
 * confere a linha, a caixa, o destinatário e completa a declaração aduaneira
 * (nome em inglês e em chinês são obrigatórios na API). Montado só enquanto
 * aberto.
 */
export function CreateCarrierShipmentDialog({
    packageId,
    initialChannelCode,
    onClose,
    onCreated,
}: CreateCarrierShipmentDialogProps) {
    const { t } = useTranslation();
    const needsEnrollment = useTotpEnrollmentGate(true, true);
    const [draft, setDraft] = useState<CarrierDraft>();
    const [channels, setChannels] = useState<CarrierChannel[]>([]);
    const [loadError, setLoadError] = useState<string>();
    const [channelCode, setChannelCode] = useState('');
    const [parcel, setParcel] = useState({
        weightGrams: '',
        lengthMillimeters: '',
        widthMillimeters: '',
        heightMillimeters: '',
    });
    const [consignee, setConsignee] = useState<CarrierConsignee>();
    const [items, setItems] = useState<ItemForm[]>([]);
    const [remember, setRemember] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        Promise.all([
            api<CarrierDraft>(`/packages/${packageId}/carrier-shipments/draft`),
            api<CarrierChannels>('/carrier-shipments/channels'),
        ])
            .then(([loadedDraft, loadedChannels]) => {
                setDraft(loadedDraft);
                setChannels(loadedChannels.channels);
                setChannelCode(initialChannelCode ?? loadedDraft.defaultChannelCode);
                setParcel({
                    weightGrams: String(loadedDraft.parcel.weightGrams ?? ''),
                    lengthMillimeters: String(loadedDraft.parcel.lengthMillimeters ?? ''),
                    widthMillimeters: String(loadedDraft.parcel.widthMillimeters ?? ''),
                    heightMillimeters: String(loadedDraft.parcel.heightMillimeters ?? ''),
                });
                setConsignee(loadedDraft.consignee);
                setItems(
                    loadedDraft.items.map((item) => ({
                        englishName: item.englishName,
                        chineseName: item.chineseName,
                        hsCode: item.hsCode,
                        unitNetWeightGrams: String(item.unitNetWeightGrams),
                        unitDeclaredUsd: (item.unitDeclaredUsdCents / 100).toFixed(2),
                    })),
                );
            })
            .catch((err) => setLoadError(err instanceof ApiError ? err.message : t('common.errors.generic')));
    }, [packageId, initialChannelCode, t]);

    const channel = channels.find((candidate) => candidate.code === channelCode);
    const declaredTotalCents = useMemo(
        () =>
            items.reduce(
                (total, item, index) =>
                    total + Math.round(Number(item.unitDeclaredUsd) * 100) * (draft?.items[index]?.quantity ?? 0),
                0,
            ),
        [items, draft],
    );

    if (needsEnrollment) return <TotpEnrollmentDialog onCancel={onClose} onEnrolled={() => undefined} open />;

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft || !consignee) return;
        const data = new FormData(event.currentTarget);
        setSubmitting(true);
        setError(undefined);
        try {
            const result = await api<CarrierRefresh>(`/packages/${packageId}/carrier-shipments`, {
                method: 'POST',
                body: JSON.stringify({
                    totpCode: String(data.get('totpCode') ?? ''),
                    channelCode,
                    parcel: {
                        weightGrams: Number(parcel.weightGrams),
                        lengthMillimeters: Number(parcel.lengthMillimeters),
                        widthMillimeters: Number(parcel.widthMillimeters),
                        heightMillimeters: Number(parcel.heightMillimeters),
                    },
                    consignee: {
                        ...consignee,
                        district: consignee.district || null,
                        address2: consignee.address2 || null,
                    },
                    items: draft.items.map((item, index) => ({
                        orderItemId: item.orderItemId,
                        quantity: item.quantity,
                        englishName: items[index].englishName.trim(),
                        chineseName: items[index].chineseName.trim(),
                        hsCode: items[index].hsCode.trim() || null,
                        unitNetWeightGrams: Number(items[index].unitNetWeightGrams),
                        unitDeclaredUsdCents: Math.round(Number(items[index].unitDeclaredUsd) * 100),
                    })),
                    rememberOnProducts: remember,
                }),
            });
            onCreated(result);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setSubmitting(false);
        }
    }

    const blocked = draft ? !draft.readyToCreate : false;

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('carrier.create.description')}
            onClose={onClose}
            open
            size="large"
            title={t('carrier.create.title')}
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button disabled={!draft || blocked} form={FORM_ID} loading={submitting} type="submit">
                        {t('carrier.create.submit')}
                    </Button>
                </>
            }
        >
            {loadError && (
                <Alert tone="danger">
                    <p>{loadError}</p>
                </Alert>
            )}
            {!draft && !loadError && <SkeletonCards label={t('carrier.create.loading')} />}

            {draft && consignee && (
                <form className="grid gap-6" id={FORM_ID} onSubmit={submit}>
                    {blocked && (
                        <Alert tone="warning" title={t('carrier.create.blocked')}>
                            <p>{draft.blockingReason}</p>
                        </Alert>
                    )}

                    <fieldset className="m-0 grid gap-3 border-0 p-0">
                        <legend className="mb-2 text-sm font-semibold text-ink dark:text-night-text">
                            {t('carrier.create.channel')}
                        </legend>
                        <Select
                            hideLabel
                            label={t('carrier.create.channel')}
                            name="channelCode"
                            onChange={(event) => setChannelCode(event.target.value)}
                            options={channels.map((option) => ({
                                value: option.code,
                                label: `${option.code} · ${option.name}${option.preferred ? ` (${t('carrier.channel.preferred')})` : ''}`,
                            }))}
                            value={channelCode}
                        />
                        {channel && (
                            <details className="rounded-lg border border-line p-3 dark:border-night-line">
                                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-semibold text-ink dark:text-night-text">
                                    {t('carrier.quote.details')}
                                    <CarrierChannelBadges channel={channel} />
                                </summary>
                                <div className="mt-3">
                                    <CarrierChannelDetails channel={channel} />
                                </div>
                            </details>
                        )}
                    </fieldset>

                    <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-4">
                        <legend className="mb-2 text-sm font-semibold text-ink dark:text-night-text">
                            {t('carrier.create.parcel')}
                        </legend>
                        {(
                            [
                                ['weightGrams', t('carrier.quote.weight'), 'g'],
                                ['lengthMillimeters', t('carrier.quote.length'), 'mm'],
                                ['widthMillimeters', t('carrier.quote.width'), 'mm'],
                                ['heightMillimeters', t('carrier.quote.height'), 'mm'],
                            ] as const
                        ).map(([name, label, suffix]) => (
                            <Input
                                inputMode="numeric"
                                key={name}
                                label={label}
                                min={1}
                                onChange={(event) =>
                                    setParcel((current) => ({ ...current, [name]: event.target.value }))
                                }
                                required
                                suffix={suffix}
                                type="number"
                                value={parcel[name]}
                            />
                        ))}
                    </fieldset>

                    <ConsigneeFields consignee={consignee} onChange={setConsignee} />

                    <fieldset className="m-0 grid gap-3 border-0 p-0">
                        <legend className="mb-1 text-sm font-semibold text-ink dark:text-night-text">
                            {t('carrier.create.declaration')}
                        </legend>
                        <p className="m-0 text-xs leading-relaxed text-muted dark:text-night-muted">
                            {t('carrier.create.declarationHint')}
                        </p>
                        {draft.items.map((item, index) => (
                            <DeclarationItem
                                form={items[index]}
                                item={item}
                                key={item.orderItemId}
                                onChange={(next) =>
                                    setItems((current) =>
                                        current.map((entry, position) => (position === index ? next : entry)),
                                    )
                                }
                            />
                        ))}
                        <p className="m-0 text-right text-sm font-semibold text-ink dark:text-night-text">
                            {t('carrier.create.total', { amount: usd(declaredTotalCents) })}
                        </p>
                        <Checkbox
                            checked={remember}
                            description={t('carrier.create.rememberHint')}
                            label={t('carrier.create.remember')}
                            onChange={(event) => setRemember(event.target.checked)}
                        />
                    </fieldset>

                    <Input
                        autoComplete="one-time-code"
                        className="font-mono tracking-[0.3em]"
                        fieldClassName="sm:max-w-xs"
                        inputMode="numeric"
                        label={t('common.fields.totpCode')}
                        maxLength={6}
                        minLength={6}
                        name="totpCode"
                        pattern="\d{6}"
                        placeholder="000000"
                        required
                    />

                    {error && (
                        <Alert tone="danger">
                            <p>{error}</p>
                        </Alert>
                    )}
                </form>
            )}
        </Modal>
    );
}

function ConsigneeFields({
    consignee,
    onChange,
}: {
    consignee: CarrierConsignee;
    onChange: (next: CarrierConsignee) => void;
}) {
    const { t } = useTranslation();
    const set = (name: keyof CarrierConsignee) => (event: { target: { value: string } }) =>
        onChange({ ...consignee, [name]: event.target.value });

    return (
        <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-6">
            <legend className="mb-2 text-sm font-semibold text-ink dark:text-night-text">
                {t('carrier.create.consignee')}
            </legend>
            <Input
                fieldClassName="sm:col-span-3"
                label={t('carrier.create.name')}
                maxLength={64}
                onChange={set('name')}
                required
                value={consignee.name}
            />
            <Input
                fieldClassName="sm:col-span-3"
                label={t('carrier.create.email')}
                maxLength={128}
                onChange={set('email')}
                required
                type="email"
                value={consignee.email}
            />
            <Input
                fieldClassName="sm:col-span-2"
                inputMode="numeric"
                label={t('carrier.create.phone')}
                onChange={set('phone')}
                pattern="\d{8,15}"
                required
                value={consignee.phone}
            />
            <Input
                fieldClassName="sm:col-span-2"
                inputMode="numeric"
                label={t('carrier.create.taxId')}
                onChange={set('taxId')}
                pattern="\d{11}(\d{3})?"
                required
                value={consignee.taxId ?? ''}
            />
            <Input
                fieldClassName="sm:col-span-2"
                inputMode="numeric"
                label={t('carrier.create.postalCode')}
                onChange={set('postalCode')}
                pattern="\d{8}"
                required
                value={consignee.postalCode}
            />
            <Input
                fieldClassName="sm:col-span-4"
                label={t('carrier.create.address')}
                maxLength={255}
                onChange={set('address')}
                required
                value={consignee.address}
            />
            <Input
                fieldClassName="sm:col-span-2"
                label={t('carrier.create.address2')}
                maxLength={50}
                onChange={set('address2')}
                value={consignee.address2 ?? ''}
            />
            <Input
                fieldClassName="sm:col-span-2"
                label={t('carrier.create.district')}
                maxLength={32}
                onChange={set('district')}
                value={consignee.district ?? ''}
            />
            <Input
                fieldClassName="sm:col-span-3"
                label={t('carrier.create.city')}
                maxLength={32}
                onChange={set('city')}
                required
                value={consignee.city}
            />
            <Input
                fieldClassName="sm:col-span-1"
                label={t('carrier.create.state')}
                maxLength={32}
                onChange={set('state')}
                required
                value={consignee.state}
            />
        </fieldset>
    );
}

function DeclarationItem({
    item,
    form,
    onChange,
}: {
    item: CarrierDraftItem;
    form: ItemForm;
    onChange: (next: ItemForm) => void;
}) {
    const { t } = useTranslation();
    const set = (name: keyof ItemForm) => (event: { target: { value: string } }) =>
        onChange({ ...form, [name]: event.target.value });

    return (
        <div className="grid gap-3 rounded-lg border border-line p-3 dark:border-night-line">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-sm text-ink dark:text-night-text">{item.productName}</strong>
                <span className="text-xs text-muted dark:text-night-muted">
                    {t('carrier.create.quantity', { count: item.quantity })} ·{' '}
                    {t('carrier.create.paid', { amount: cny(item.unitPaidAmountMinor) })}
                </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-6">
                <Input
                    fieldClassName="sm:col-span-3"
                    label={t('carrier.create.englishName')}
                    maxLength={64}
                    minLength={2}
                    onChange={set('englishName')}
                    placeholder="Trading cards"
                    required
                    value={form.englishName}
                />
                <Input
                    fieldClassName="sm:col-span-3"
                    label={t('carrier.create.chineseName')}
                    maxLength={100}
                    onChange={set('chineseName')}
                    placeholder="卡牌"
                    required
                    value={form.chineseName}
                />
                <Input
                    fieldClassName="sm:col-span-2"
                    inputMode="numeric"
                    label={t('carrier.create.hsCode')}
                    onChange={set('hsCode')}
                    pattern="\d{4,12}"
                    value={form.hsCode}
                />
                <Input
                    fieldClassName="sm:col-span-2"
                    inputMode="numeric"
                    label={t('carrier.create.unitWeight')}
                    min={1}
                    onChange={set('unitNetWeightGrams')}
                    required
                    suffix="g"
                    type="number"
                    value={form.unitNetWeightGrams}
                />
                <Input
                    fieldClassName="sm:col-span-2"
                    inputMode="decimal"
                    label={t('carrier.create.unitValue')}
                    min={0.01}
                    onChange={set('unitDeclaredUsd')}
                    required
                    step={0.01}
                    suffix="USD"
                    type="number"
                    value={form.unitDeclaredUsd}
                />
            </div>
        </div>
    );
}
