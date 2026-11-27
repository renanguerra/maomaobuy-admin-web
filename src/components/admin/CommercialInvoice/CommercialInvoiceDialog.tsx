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
import { usd, type CarrierDraft, type CarrierDraftItem, type CarrierShipment } from '@/types/carrier';
import {
    buildCommercialInvoiceFile,
    DEFAULT_SHIPPER,
    invoiceFileName,
    invoiceIncludesFreight,
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

/** De onde vêm os itens: o que foi declarado à Westlink ou o cadastro atual dos produtos. */
type ItemsSource = 'WESTLINK' | 'PRODUCTS';

/** Uma linha do invoice, venha do cadastro ou da declaração já feita na Westlink. */
interface InvoiceRow {
    key: string;
    title: string;
    quantity: number;
    /** Item do pedido de onde a linha veio; `null` na linha da Westlink sem par no pacote. */
    source: CarrierDraftItem | null;
    /** Nomes, HS e valor vêm da Westlink: o invoice tem de repetir o que a alfândega recebeu. */
    locked: boolean;
}

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

/** O cadastro guarda sim/não; o invoice escreve em inglês. */
function electricMagneticLabel(value: boolean | null | undefined): string | undefined {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return undefined;
}

function itemFormFrom(item: CarrierDraftItem, remembered: Record<string, RememberedProduct>): ItemForm {
    const known = item.productId ? remembered[item.productId] : undefined;
    return {
        description: item.englishName || known?.description || '',
        chineseName: item.chineseName || known?.chineseName || '',
        hsCode: item.hsCode || known?.hsCode || '',
        brand: item.brand || known?.brand || '',
        material: item.material || known?.material || '',
        purpose: item.purpose || known?.purpose || '',
        electricMagnetic: electricMagneticLabel(item.electricMagnetic) ?? known?.electricMagnetic ?? 'No',
        unitValueUsd: (item.unitDeclaredUsdCents / 100).toFixed(2),
    };
}

function productRows(draft: CarrierDraft): InvoiceRow[] {
    return draft.items.map((item) => ({
        key: item.orderItemId,
        title: item.productName,
        quantity: item.quantity,
        source: item,
        locked: false,
    }));
}

/**
 * Linhas a partir do envio da Westlink. O envio grava a declaração na ordem dos
 * itens do rascunho; o par só vale se as contas baterem, e serve para trazer
 * marca, material e uso, que a Westlink não pede.
 */
function westlinkRows(declared: CarrierShipment['declared'], draft: CarrierDraft): InvoiceRow[] {
    const paired = declared.items.length === draft.items.length;
    return declared.items.map((item, index) => ({
        key: `westlink-${index}`,
        title: paired ? draft.items[index].productName : item.englishName,
        quantity: item.quantity,
        source: paired ? draft.items[index] : null,
        locked: true,
    }));
}

function westlinkForms(
    declared: CarrierShipment['declared'],
    rows: InvoiceRow[],
    remembered: Record<string, RememberedProduct>,
): ItemForm[] {
    return declared.items.map((item, index) => {
        const base = rows[index].source ? itemFormFrom(rows[index].source, remembered) : undefined;
        return {
            description: item.englishName,
            chineseName: item.chineseName,
            hsCode: item.hsCode ?? '',
            brand: base?.brand ?? '',
            material: base?.material ?? '',
            purpose: base?.purpose ?? '',
            electricMagnetic: base?.electricMagnetic ?? 'No',
            unitValueUsd: (item.unitDeclaredUsdCents / 100).toFixed(2),
        };
    });
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
 * Monta o commercial invoice do pacote. Vem preenchido com o destinatário, os
 * valores pagos em dólar e os dados de invoice do cadastro de cada produto
 * (nomes, HS, marca, material, uso); o que faltar a equipe completa aqui, e
 * fica lembrado neste navegador. Baixa ou anexa a planilha.
 * Montado só enquanto aberto.
 */
export function CommercialInvoiceDialog({ pkg, onClose, onAttach }: CommercialInvoiceDialogProps) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<CarrierDraft>();
    const [westlink, setWestlink] = useState<CarrierShipment | null>(null);
    const [itemsSource, setItemsSource] = useState<ItemsSource>('PRODUCTS');
    const [rows, setRows] = useState<InvoiceRow[]>([]);
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
        Promise.all([
            api<CarrierDraft>(`/packages/${pkg.id}/carrier-shipments/draft`),
            // Sem envio na Westlink (ou sem acesso) o invoice segue pelo cadastro.
            api<CarrierShipment[]>(`/packages/${pkg.id}/carrier-shipments`).catch(() => []),
        ])
            .then(([loaded, shipments]) => {
                const shipment = shipments.find((entry) => entry.status === 'CREATED') ?? null;
                setDraft(loaded);
                setWestlink(shipment);
                setCustomShipper(readStored(SHIPPER_STORAGE_KEY, EMPTY_SHIPPER));
                applySource(shipment ? 'WESTLINK' : 'PRODUCTS', loaded, shipment);
                if (shipment?.trackingNumber) setWaybillNumber(shipment.trackingNumber);
                if (pkg.shippingAmountMinor)
                    setFreightUsd((Number(pkg.shippingAmountMinor) / loaded.usdToCnyRate / 100).toFixed(2));
            })
            .catch((err) => setLoadError(err instanceof ApiError ? err.message : t('common.errors.generic')));
    }, [pkg.id, pkg.shippingAmountMinor, t]);

    function applySource(source: ItemsSource, loaded: CarrierDraft, shipment: CarrierShipment | null) {
        const remembered = readStored<Record<string, RememberedProduct>>(PRODUCTS_STORAGE_KEY, {});
        setItemsSource(source);
        if (source === 'WESTLINK' && shipment) {
            const next = westlinkRows(shipment.declared, loaded);
            setRows(next);
            setItems(westlinkForms(shipment.declared, next, remembered));
            return;
        }
        setRows(productRows(loaded));
        setItems(loaded.items.map((item) => itemFormFrom(item, remembered)));
    }

    const itemsTotalCents = useMemo(
        () =>
            invoiceItemsTotalCents(
                items.map((item, index) => ({
                    quantity: rows[index]?.quantity ?? 0,
                    unitValueCents: toCents(item.unitValueUsd),
                })),
            ),
        [items, rows],
    );
    const paidTotalCents = useMemo(
        () => (draft?.items ?? []).reduce((total, item) => total + item.quantity * item.unitDeclaredUsdCents, 0),
        [draft],
    );

    function selectedShipper(): InvoiceParty {
        if (shipperMode === 'DEFAULT') return DEFAULT_SHIPPER;
        return shipperMode === 'CUSTOM' ? customShipper : EMPTY_SHIPPER;
    }

    function buildInvoice(): CommercialInvoice {
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
            items: rows.map((row, index) => ({
                chineseName: items[index].chineseName.trim(),
                description: items[index].description.trim(),
                brand: items[index].brand.trim(),
                electricMagnetic: items[index].electricMagnetic.trim(),
                hsCode: items[index].hsCode.trim(),
                purpose: items[index].purpose.trim(),
                material: items[index].material.trim(),
                quantity: row.quantity,
                unitValueCents: toCents(items[index].unitValueUsd),
            })),
            numberOfUnits: Number(numberOfUnits),
            destinationCountry: countryName(destination.countryCode),
            shippingWay:
                itemsSource === 'WESTLINK'
                    ? 'By Express (Westlink)'
                    : pkg.carrier
                      ? `By Express (${pkg.carrier})`
                      : 'By Express',
            terms: terms.trim(),
            freightCents: invoiceIncludesFreight(model) ? toCents(freightUsd) : 0,
            reasonForExport: reasonForExport.trim(),
        };
    }

    function rememberEntries() {
        if (shipperMode === 'CUSTOM') writeStored(SHIPPER_STORAGE_KEY, customShipper);
        const remembered = readStored<Record<string, RememberedProduct>>(PRODUCTS_STORAGE_KEY, {});
        rows.forEach((row, index) => {
            const item = row.source;
            // Da Westlink só se aprende o que ela não pediu: o resto já está no envio.
            if (!item?.productId || row.locked) return;
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
            const blob = await buildCommercialInvoiceFile(buildInvoice(), model);
            const fileName = invoiceFileName(pkg.packageCode);
            rememberEntries();
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

                    {westlink && (
                        <Select
                            hint={t(`packages.detail.invoice.source${itemsSource}Hint`)}
                            label={t('packages.detail.invoice.source')}
                            name="invoiceItemsSource"
                            onChange={(event) => applySource(event.target.value as ItemsSource, draft, westlink)}
                            options={[
                                { value: 'WESTLINK', label: t('packages.detail.invoice.sourceWESTLINK') },
                                { value: 'PRODUCTS', label: t('packages.detail.invoice.sourcePRODUCTS') },
                            ]}
                            value={itemsSource}
                        />
                    )}

                    <Select
                        hint={t(`packages.detail.invoice.modelHint${model}`)}
                        label={t('packages.detail.invoice.model')}
                        name="invoiceModel"
                        onChange={(event) => setModel(event.target.value as InvoiceModel)}
                        options={[
                            { value: 'DETAILED', label: t('packages.detail.invoice.modelDETAILED') },
                            { value: 'SIMPLE', label: t('packages.detail.invoice.modelSIMPLE') },
                            { value: 'ABC_LEO', label: t('packages.detail.invoice.modelABC_LEO') },
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
                                {model !== 'SIMPLE' && (
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
                        {model !== 'SIMPLE' && (
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
                        {invoiceIncludesFreight(model) && (
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
                        )}
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
                        {itemsSource === 'PRODUCTS' && (
                            <p className="m-0 text-xs leading-relaxed text-muted dark:text-night-muted">
                                {t('packages.detail.invoice.itemsHint', { rate: draft.usdToCnyRate })}
                            </p>
                        )}
                        {rows.map((row, index) => (
                            <InvoiceItemFields
                                form={items[index]}
                                key={row.key}
                                row={row}
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
                                amount: usd(
                                    itemsTotalCents + (invoiceIncludesFreight(model) ? toCents(freightUsd) : 0),
                                ),
                            })}
                        </p>
                        {itemsSource === 'PRODUCTS' && itemsTotalCents < paidTotalCents && (
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
    row,
    form,
    model,
    onChange,
}: {
    row: InvoiceRow;
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
                <strong className="text-sm text-ink dark:text-night-text">{row.title}</strong>
                <span className="text-xs text-muted dark:text-night-muted">
                    {t('carrier.create.quantity', { count: row.quantity })}
                    {row.source && <> · {t('carrier.create.paid', { amount: cny(row.source.unitPaidAmountMinor) })}</>}
                </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-6">
                <Input
                    fieldClassName="sm:col-span-3"
                    label={t('carrier.create.englishName')}
                    readOnly={row.locked}
                    onChange={set('description')}
                    placeholder="Trading cards"
                    required
                    value={form.description}
                />
                {model === 'DETAILED' && (
                    <Input
                        fieldClassName="sm:col-span-3"
                        label={t('carrier.create.chineseName')}
                        readOnly={row.locked}
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
                    readOnly={row.locked}
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
                    readOnly={row.locked}
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
