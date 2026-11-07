'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert } from '@/components/admin/Alert';
import { SkeletonCards } from '@/components/admin/Skeleton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api, ApiError } from '@/services/api';
import { cny, type AdminPackage } from '@/types/api';
import { usd, type CarrierDraft, type CarrierDraftItem } from '@/types/carrier';
import {
    buildCommercialInvoiceFile,
    DEFAULT_SHIPPER,
    invoiceFileName,
    invoiceItemsTotalCents,
    XLSX_MIME_TYPE,
    type CommercialInvoice,
    type InvoiceModel,
    type InvoiceParty,
} from './commercial-invoice';

const FORM_ID = 'commercial-invoice-form';
const SHIPPER_STORAGE_KEY = 'maomaobuy.invoice.shipper';
const PRODUCTS_STORAGE_KEY = 'maomaobuy.invoice.products';

interface CommercialInvoiceDialogProps {
    pkg: AdminPackage;
    onClose: () => void;
    /** Anexa ao pacote pelo mesmo caminho do botão de anexar documento. */
    onAttach: (file: File) => Promise<void>;
}

interface ItemForm {
    description: string;
    chineseName: string;
    hsCode: string;
    brand: string;
    material: string;
    purpose: string;
    electricMagnetic: string;
    /** Em dólares, como o admin digita ("12.50"). */
    unitValueUsd: string;
}

type ShipperMode = 'DEFAULT' | 'NONE' | 'CUSTOM';

type RememberedProduct = Omit<ItemForm, 'unitValueUsd'>;

const EMPTY_SHIPPER: InvoiceParty = { company: '', address: '', postalCode: '', attention: '', phone: '' };

function readStored<T>(key: string, fallback: T): T {
    try {
        const stored = window.localStorage.getItem(key);
        return stored ? { ...fallback, ...(JSON.parse(stored) as T) } : fallback;
    } catch {
        return fallback;
    }
}

function writeStored(key: string, value: unknown) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Sem armazenamento a equipe só digita de novo na próxima vez.
    }
}

function itemFormFrom(item: CarrierDraftItem, remembered: Record<string, RememberedProduct>): ItemForm {
    const known = item.productId ? remembered[item.productId] : undefined;
    return {
        description: item.englishName || known?.description || '',
        chineseName: item.chineseName || known?.chineseName || '',
        hsCode: item.hsCode || known?.hsCode || '',
        brand: known?.brand ?? '',
        material: known?.material ?? '',
        purpose: known?.purpose ?? '',
        electricMagnetic: known?.electricMagnetic ?? 'No',
        unitValueUsd: (item.unitDeclaredUsdCents / 100).toFixed(2),
    };
}

function countryName(countryCode: string): string {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase()) ?? countryCode;
}

function destinationAddress(pkg: AdminPackage): string {
    const { destination } = pkg;
    return [
        destination.addressLine1,
        destination.addressLine2,
        destination.district,
        `${destination.locality}/${destination.administrativeArea}`,
        countryName(destination.countryCode),
    ]
        .filter(Boolean)
        .join(', ');
}

function toCents(value: string): number {
    return Math.round(Number(value) * 100);
}

/**
 * Monta o commercial invoice do pacote. Vem preenchido com o destinatário e os
 * valores pagos, convertidos em dólar; a equipe completa o que o sistema não
 * guarda (exportador, marca, material, uso) e baixa ou anexa a planilha.
 * Montado só enquanto aberto.
 */
export function CommercialInvoiceDialog({ pkg, onClose, onAttach }: CommercialInvoiceDialogProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<CarrierDraft>();
    const [loadError, setLoadError] = useState<string>();
    const [model, setModel] = useState<InvoiceModel>('DETAILED');
    const [shipperMode, setShipperMode] = useState<ShipperMode>('DEFAULT');
    const [customShipper, setCustomShipper] = useState<InvoiceParty>(EMPTY_SHIPPER);
    const [items, setItems] = useState<ItemForm[]>([]);
    const [stateRegistration, setStateRegistration] = useState('');
    const [numberOfUnits, setNumberOfUnits] = useState('1');
    const [terms, setTerms] = useState(`DAP ${countryName(pkg.destination.countryCode)}`);
    const [freightUsd, setFreightUsd] = useState('');
    const [reasonForExport, setReasonForExport] = useState('Commercial sale');
    const [waybillNumber, setWaybillNumber] = useState(pkg.trackingCode ?? '');
    const [attachOnSubmit, setAttachOnSubmit] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        api<CarrierDraft>(`/packages/${pkg.id}/carrier-shipments/draft`)
            .then((loaded) => {
                const remembered = readStored<Record<string, RememberedProduct>>(PRODUCTS_STORAGE_KEY, {});
                setDraft(loaded);
                setCustomShipper(readStored(SHIPPER_STORAGE_KEY, EMPTY_SHIPPER));
                setItems(loaded.items.map((item) => itemFormFrom(item, remembered)));
                if (pkg.shippingAmountMinor)
                    setFreightUsd((Number(pkg.shippingAmountMinor) / loaded.usdToCnyRate / 100).toFixed(2));
            })
            .catch((err) => setLoadError(err instanceof ApiError ? err.message : t('common.errors.generic')));
    }, [pkg.id, pkg.shippingAmountMinor, t]);

    const itemsTotalCents = useMemo(
        () =>
            invoiceItemsTotalCents(
                items.map((item, index) => ({
                    quantity: draft?.items[index]?.quantity ?? 0,
                    unitValueCents: toCents(item.unitValueUsd),
                })),
            ),
        [items, draft],
    );
    const paidTotalCents = useMemo(
        () => (draft?.items ?? []).reduce((total, item) => total + item.quantity * item.unitDeclaredUsdCents, 0),
        [draft],
    );

    function selectedShipper(): InvoiceParty {
        if (shipperMode === 'DEFAULT') return DEFAULT_SHIPPER;
        return shipperMode === 'CUSTOM' ? customShipper : EMPTY_SHIPPER;
    }

    function buildInvoice(loaded: CarrierDraft): CommercialInvoice {
        const { destination } = pkg;
        return {
            invoiceNumber: `INV-${pkg.packageCode}`,
            date: new Date().toISOString().slice(0, 10),
            waybillNumber: waybillNumber.trim(),
            shipper: selectedShipper(),
            consignee: {
                company: destination.recipientCompanyName ?? destination.recipientFullName,
                address: destinationAddress(pkg),
                postalCode: destination.postalCode,
                attention: destination.recipientFullName,
                phone: destination.phoneE164,
                email: pkg.userEmail,
                taxId: destination.recipientTaxId ?? '',
                taxIdLabel: destination.recipientTaxIdType ?? 'CPF',
                stateRegistration: stateRegistration.trim(),
            },
            items: loaded.items.map((item, index) => ({
                chineseName: items[index].chineseName.trim(),
                description: items[index].description.trim(),
                brand: items[index].brand.trim(),
                electricMagnetic: items[index].electricMagnetic.trim(),
                hsCode: items[index].hsCode.trim(),
                purpose: items[index].purpose.trim(),
                material: items[index].material.trim(),
                quantity: item.quantity,
                unitValueCents: toCents(items[index].unitValueUsd),
            })),
            numberOfUnits: Number(numberOfUnits),
            shippingWay: pkg.carrier ? `By Express (${pkg.carrier})` : 'By Express',
            terms: terms.trim(),
            freightCents: toCents(freightUsd),
            reasonForExport: reasonForExport.trim(),
        };
    }

    function rememberEntries(loaded: CarrierDraft) {
        if (shipperMode === 'CUSTOM') writeStored(SHIPPER_STORAGE_KEY, customShipper);
        const remembered = readStored<Record<string, RememberedProduct>>(PRODUCTS_STORAGE_KEY, {});
        loaded.items.forEach((item, index) => {
            if (!item.productId) return;
            const { description, chineseName, hsCode, brand, material, purpose, electricMagnetic } = items[index];
            remembered[item.productId] = {
                description,
                chineseName,
                hsCode,
                brand,
                material,
                purpose,
                electricMagnetic,
            };
        });
        writeStored(PRODUCTS_STORAGE_KEY, remembered);
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft) return;
        setSubmitting(true);
        setError(undefined);
        try {
            const blob = await buildCommercialInvoiceFile(buildInvoice(draft), model);
            const fileName = invoiceFileName(pkg.packageCode);
            rememberEntries(draft);
            if (attachOnSubmit) {
                await onAttach(new File([blob], fileName, { type: XLSX_MIME_TYPE }));
                onClose();
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : t('common.errors.generic'));
        } finally {
            setSubmitting(false);
        }
    }

    const setShipperField = (name: keyof InvoiceParty) => (event: { target: { value: string } }) =>
        setCustomShipper((current) => ({ ...current, [name]: event.target.value }));

    return (
        <Modal
            closeLabel={t('common.closeAria')}
            description={t('packages.detail.invoice.description')}
            onClose={onClose}
            open
            size="large"
            title={t('packages.detail.invoice.title')}
            footer={
                <>
                    <Button disabled={submitting} onClick={onClose} type="button" variant="ghost">
                        {t('common.actions.cancel')}
                    </Button>
                    <Button
                        disabled={!draft}
                        form={FORM_ID}
                        loading={submitting && !attachOnSubmit}
                        onClick={() => setAttachOnSubmit(false)}
                        type="submit"
                        variant="secondary"
                    >
                        {t('packages.detail.invoice.download')}
                    </Button>
                    <Button
                        disabled={!draft}
                        form={FORM_ID}
                        loading={submitting && attachOnSubmit}
                        onClick={() => setAttachOnSubmit(true)}
                        type="submit"
                    >
                        {t('packages.detail.invoice.attach')}
                    </Button>
                </>
            }
        >
            {loadError && (
                <Alert tone="danger">
                    <p>{loadError}</p>
                </Alert>
            )}
            {!draft && !loadError && <SkeletonCards label={t('packages.detail.invoice.loading')} />}

            {draft && (
                <form className="grid gap-6" id={FORM_ID} onSubmit={submit}>
                    {pkg.declaration?.mode === 'CUSTOM' && (
                        <Alert tone="warning" title={t('packages.detail.invoice.customDeclaration')}>
                            <p>{pkg.declaration.description}</p>
                        </Alert>
                    )}

                    <Select
                        hint={t(`packages.detail.invoice.modelHint${model}`)}
                        label={t('packages.detail.invoice.model')}
                        name="invoiceModel"
                        onChange={(event) => setModel(event.target.value as InvoiceModel)}
                        options={[
                            { value: 'DETAILED', label: t('packages.detail.invoice.modelDETAILED') },
                            { value: 'SIMPLE', label: t('packages.detail.invoice.modelSIMPLE') },
                        ]}
                        value={model}
                    />

                    <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-6">
                        <legend className="mb-2 text-sm font-semibold text-ink dark:text-night-text">
                            {t('packages.detail.invoice.shipper')}
                        </legend>
                        <Select
                            fieldClassName="sm:col-span-6"
                            hideLabel
                            label={t('packages.detail.invoice.shipper')}
                            name="shipperMode"
                            onChange={(event) => setShipperMode(event.target.value as ShipperMode)}
                            options={[
                                { value: 'DEFAULT', label: DEFAULT_SHIPPER.company },
                                { value: 'NONE', label: t('packages.detail.invoice.shipperNone') },
                                { value: 'CUSTOM', label: t('packages.detail.invoice.shipperCustom') },
                            ]}
                            value={shipperMode}
                        />
                        {shipperMode === 'DEFAULT' && (
                            <p className="m-0 text-xs leading-relaxed text-muted sm:col-span-6 dark:text-night-muted">
                                {DEFAULT_SHIPPER.address}
                            </p>
                        )}
                        {shipperMode === 'CUSTOM' && (
                            <>
                                <Input
                                    fieldClassName="sm:col-span-6"
                                    label={t('packages.detail.invoice.shipperCompany')}
                                    onChange={setShipperField('company')}
                                    required
                                    value={customShipper.company}
                                />
                                <Input
                                    fieldClassName="sm:col-span-4"
                                    label={t('packages.detail.invoice.shipperAddress')}
                                    onChange={setShipperField('address')}
                                    required
                                    value={customShipper.address}
                                />
                                {model === 'DETAILED' && (
                                    <>
                                        <Input
                                            fieldClassName="sm:col-span-2"
                                            label={t('packages.detail.invoice.postalCode')}
                                            onChange={setShipperField('postalCode')}
                                            value={customShipper.postalCode}
                                        />
                                        <Input
                                            fieldClassName="sm:col-span-3"
                                            label={t('packages.detail.invoice.attention')}
                                            onChange={setShipperField('attention')}
                                            value={customShipper.attention}
                                        />
                                        <Input
                                            fieldClassName="sm:col-span-3"
                                            label={t('packages.detail.invoice.phone')}
                                            onChange={setShipperField('phone')}
                                            value={customShipper.phone}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </fieldset>

                    <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-6">
                        <legend className="mb-2 text-sm font-semibold text-ink dark:text-night-text">
                            {t('packages.detail.invoice.shipment')}
                        </legend>
                        <Input
                            fieldClassName="sm:col-span-3"
                            label={t('packages.detail.invoice.waybill')}
                            onChange={(event) => setWaybillNumber(event.target.value)}
                            value={waybillNumber}
                        />
                        <Input
                            fieldClassName="sm:col-span-3"
                            hint={t('packages.detail.invoice.stateRegistrationHint')}
                            label={t('packages.detail.invoice.stateRegistration')}
                            onChange={(event) => setStateRegistration(event.target.value)}
                            value={stateRegistration}
                        />
                        <Input
                            fieldClassName="sm:col-span-2"
                            label={t('packages.detail.invoice.terms')}
                            onChange={(event) => setTerms(event.target.value)}
                            required
                            value={terms}
                        />
                        {model === 'DETAILED' && (
                            <Input
                                fieldClassName="sm:col-span-2"
                                inputMode="numeric"
                                label={t('packages.detail.invoice.units')}
                                min={1}
                                onChange={(event) => setNumberOfUnits(event.target.value)}
                                required
                                type="number"
                                value={numberOfUnits}
                            />
                        )}
                        <Input
                            fieldClassName="sm:col-span-2"
                            inputMode="decimal"
                            label={t('packages.detail.invoice.freight')}
                            min={0}
                            onChange={(event) => setFreightUsd(event.target.value)}
                            required
                            step={0.01}
                            suffix="USD"
                            type="number"
                            value={freightUsd}
                        />
                        <Input
                            fieldClassName="sm:col-span-6"
                            label={t('packages.detail.invoice.reason')}
                            onChange={(event) => setReasonForExport(event.target.value)}
                            required
                            value={reasonForExport}
                        />
                    </fieldset>

                    <fieldset className="m-0 grid gap-3 border-0 p-0">
                        <legend className="mb-1 text-sm font-semibold text-ink dark:text-night-text">
                            {t('packages.detail.invoice.items')}
                        </legend>
                        <p className="m-0 text-xs leading-relaxed text-muted dark:text-night-muted">
                            {t('packages.detail.invoice.itemsHint', { rate: draft.usdToCnyRate })}
                        </p>
                        {draft.items.map((item, index) => (
                            <InvoiceItemFields
                                form={items[index]}
                                item={item}
                                key={item.orderItemId}
                                model={model}
                                onChange={(next) =>
                                    setItems((current) =>
                                        current.map((entry, position) => (position === index ? next : entry)),
                                    )
                                }
                            />
                        ))}
                        <p className="m-0 text-right text-sm font-semibold text-ink dark:text-night-text">
                            {t('packages.detail.invoice.total', {
                                amount: usd(itemsTotalCents + toCents(freightUsd)),
                            })}
                        </p>
                        {itemsTotalCents < paidTotalCents && (
                            <Alert tone="warning">
                                <p>
                                    {t('packages.detail.invoice.belowPaid', {
                                        declared: usd(itemsTotalCents),
                                        paid: usd(paidTotalCents),
                                    })}
                                </p>
                            </Alert>
                        )}
                    </fieldset>

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

function InvoiceItemFields({
    item,
    form,
    model,
    onChange,
}: {
    item: CarrierDraftItem;
    form: ItemForm;
    model: InvoiceModel;
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
                    onChange={set('description')}
                    placeholder="Trading cards"
                    required
                    value={form.description}
                />
                {model === 'DETAILED' && (
                    <Input
                        fieldClassName="sm:col-span-3"
                        label={t('carrier.create.chineseName')}
                        onChange={set('chineseName')}
                        placeholder="卡牌"
                        required
                        value={form.chineseName}
                    />
                )}
                <Input
                    fieldClassName="sm:col-span-2"
                    inputMode="numeric"
                    label={t('carrier.create.hsCode')}
                    onChange={set('hsCode')}
                    pattern="\d{4,12}"
                    required
                    value={form.hsCode}
                />
                {model === 'DETAILED' && (
                    <>
                        <Input
                            fieldClassName="sm:col-span-2"
                            label={t('packages.detail.invoice.brand')}
                            onChange={set('brand')}
                            required
                            value={form.brand}
                        />
                        <Input
                            fieldClassName="sm:col-span-2"
                            label={t('packages.detail.invoice.electricMagnetic')}
                            onChange={set('electricMagnetic')}
                            required
                            value={form.electricMagnetic}
                        />
                    </>
                )}
                <Input
                    fieldClassName="sm:col-span-2"
                    label={t('packages.detail.invoice.material')}
                    onChange={set('material')}
                    placeholder="Paper"
                    required
                    value={form.material}
                />
                <Input
                    fieldClassName="sm:col-span-2"
                    label={t('packages.detail.invoice.purpose')}
                    onChange={set('purpose')}
                    placeholder="Collectible card game"
                    required
                    value={form.purpose}
                />
                <Input
                    fieldClassName="sm:col-span-2"
                    inputMode="decimal"
                    label={t('carrier.create.unitValue')}
                    min={0.01}
                    onChange={set('unitValueUsd')}
                    required
                    step={0.01}
                    suffix="USD"
                    type="number"
                    value={form.unitValueUsd}
                />
            </div>
        </div>
    );
}
