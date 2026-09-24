'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ImageOff, LoaderCircle, Printer } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import {
    formatCpf,
    formatDate,
    formatPhone,
    inspectionStatusLabel,
    orderStatusLabel,
    packageStatusLabel,
    productSourceLabel,
    type AdminPackageAssembly,
    type AdminPackageAssemblyItem,
    type AdminPackageAssemblyOrder,
} from '@/types/api';

/**
 * Lê `?ids=a,b,c` (também aceita `ids=a&ids=b`), sem repetição e sem vazio.
 * A ordem é preservada: é a ordem das folhas.
 */
function parseIds(params: URLSearchParams): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const raw of params.getAll('ids'))
        for (const piece of raw.split(',')) {
            const id = piece.trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            ids.push(id);
        }
    return ids;
}

function shortOrderId(id: string) {
    return `#${id.slice(0, 8)}`;
}

/**
 * Folha de montagem: uma página por pacote, pensada para o papel. Não usa a
 * moldura do painel nem o tema escuro — o que sai da impressora é sempre
 * fundo branco e tinta escura, então as cores aqui são fixas de propósito.
 */
export function AssemblySheetPage() {
    const { t } = useTranslation();
    const searchParams = useSearchParams();
    const ids = useMemo(() => parseIds(searchParams), [searchParams]);
    const idsKey = ids.join(',');

    const [loaded, setLoaded] = useState<{ key: string; sheets: AdminPackageAssembly[] }>();
    const [failure, setFailure] = useState<{ key: string; message: string }>();
    // Fixada uma vez por carga: o rodapé de cada folha diz quando ela foi
    // gerada, e esse instante não muda enquanto a tela está aberta.
    const [generatedAt] = useState(() => new Date().toISOString());

    const sheets = loaded?.key === idsKey ? loaded.sheets : undefined;
    const error = failure?.key === idsKey ? failure.message : undefined;
    const loading = ids.length > 0 && !sheets && !error;

    useEffect(() => {
        if (ids.length === 0) return;
        let active = true;
        const key = ids.join(',');
        api<AdminPackageAssembly[]>(`/packages/assembly-sheet?ids=${encodeURIComponent(key)}`)
            .then((result) => {
                if (active) setLoaded({ key, sheets: result });
            })
            .catch(() => {
                if (active) setFailure({ key, message: t('packages.assembly.error') });
            });
        return () => {
            active = false;
        };
    }, [ids, t]);

    useEffect(() => {
        if (!sheets || sheets.length === 0) return;
        const codes = sheets.map((sheet) => sheet.packageCode).join(', ');
        document.title = `${t('packages.assembly.title')} · ${codes}`;
    }, [sheets, t]);

    return (
        <div className="min-h-screen bg-warm-200 text-warm-950 print:bg-white">
            <header className="sticky top-0 z-10 border-b border-warm-300 bg-warm-50/95 backdrop-blur print:hidden">
                <div className="mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <ButtonLink
                            href="/admin/pacotes"
                            leadingIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
                            size="small"
                            variant="ghost"
                        >
                            {t('packages.assembly.backLink')}
                        </ButtonLink>
                        <div className="min-w-0">
                            <h1 className="mm-display m-0 text-base leading-tight">{t('packages.assembly.title')}</h1>
                            <p className="m-0 text-xs text-warm-600">{t('packages.assembly.description')}</p>
                        </div>
                    </div>
                    <Button
                        disabled={!sheets || sheets.length === 0}
                        leadingIcon={<Printer className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => window.print()}
                        size="small"
                    >
                        {t('packages.assembly.print')}
                    </Button>
                </div>
            </header>

            <main className="mx-auto grid w-full max-w-[210mm] gap-6 px-4 py-6 print:block print:max-w-none print:gap-0 print:p-0">
                {ids.length === 0 && (
                    <Alert tone="warning" title={t('packages.assembly.title')}>
                        <p>{t('packages.assembly.missingIds')}</p>
                    </Alert>
                )}

                {error && (
                    <Alert tone="danger" title={t('common.errors.loadTitle')}>
                        <p>{error}</p>
                    </Alert>
                )}

                {loading && (
                    <div
                        className="flex items-center gap-3 py-16 text-sm font-semibold text-warm-600"
                        aria-busy="true"
                        aria-live="polite"
                    >
                        <LoaderCircle className="h-5 w-5 animate-spin text-brand-700" aria-hidden="true" />
                        {t('packages.assembly.loading')}
                    </div>
                )}

                {sheets && sheets.length === 0 && (
                    <Alert tone="warning" title={t('packages.assembly.title')}>
                        <p>{t('packages.assembly.empty')}</p>
                    </Alert>
                )}

                {sheets && sheets.length > 0 && sheets.length < ids.length && (
                    <div className="print:hidden">
                        <Alert tone="warning" title={t('packages.assembly.title')}>
                            <p>{t('packages.assembly.partial', { found: sheets.length, requested: ids.length })}</p>
                        </Alert>
                    </div>
                )}

                {sheets?.map((sheet, index) => (
                    <Sheet
                        generatedAt={generatedAt}
                        key={sheet.id}
                        page={index + 1}
                        sheet={sheet}
                        total={sheets.length}
                    />
                ))}
            </main>
        </div>
    );
}

interface SheetProps {
    sheet: AdminPackageAssembly;
    page: number;
    total: number;
    generatedAt: string;
}

function Sheet({ sheet, page, total, generatedAt }: SheetProps) {
    const { t } = useTranslation();
    const ordersById = new Map(sheet.orders.map((order) => [order.id, order]));
    const units = sheet.items.reduce((sum, item) => sum + item.quantity, 0);
    const destination = sheet.destination;
    const hasDimensions = sheet.lengthMillimeters && sheet.widthMillimeters && sheet.heightMillimeters;

    return (
        <article
            className="mm-print-sheet flex min-h-[297mm] flex-col gap-4 rounded-lg border border-warm-300 bg-warm-50 p-[12mm] text-[11px] leading-snug shadow-sm print:min-h-0 print:break-after-page print:rounded-none print:border-0 print:p-0 print:shadow-none"
            aria-label={`${t('packages.assembly.title')} ${sheet.packageCode}`}
        >
            <header className="flex items-start justify-between gap-4 border-b-2 border-warm-950 pb-3">
                <div className="min-w-0">
                    <span className="block text-[10px] font-bold tracking-[.08em] text-warm-600 uppercase">
                        {t('packages.assembly.kicker')} · {t('packages.assembly.title')}
                    </span>
                    <h2 className="mm-display m-0 mt-1 text-2xl leading-none">{sheet.packageCode}</h2>
                    <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-warm-700">
                        <span className="rounded border border-warm-400 px-1.5 py-0.5 font-semibold text-warm-900">
                            {packageStatusLabel(sheet.status)}
                        </span>
                        <span>
                            {t('packages.assembly.fields.createdAt')}: {formatDate(sheet.createdAt)}
                        </span>
                        {sheet.paidAt && (
                            <span>
                                · {t('packages.assembly.fields.paidAt')}: {formatDate(sheet.paidAt)}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <Image
                        alt="MaoMaoBuy"
                        className="h-8 w-8"
                        height={32}
                        src="/brand/logo-kit/svg/maomaobuy-symbol.svg"
                        width={32}
                    />
                    <span className="mm-data text-xs font-semibold">
                        {t('packages.assembly.pageOf', { page, total })}
                    </span>
                    <span className="text-[10px] text-warm-600">
                        {t('packages.assembly.generatedAt', { date: formatDate(generatedAt) })}
                    </span>
                </div>
            </header>

            <section className="grid grid-cols-3 gap-3 print:break-inside-avoid">
                <InfoBlock title={t('packages.assembly.sections.client')}>
                    <strong className="block text-xs">{sheet.userName}</strong>
                    <span className="block break-all text-warm-700">{sheet.userEmail}</span>
                </InfoBlock>
                <InfoBlock title={t('packages.assembly.sections.destination')}>
                    <address className="m-0 not-italic">
                        <strong className="block text-xs">{destination.recipientFullName}</strong>
                        <span className="mm-data block">{formatPhone(destination.phoneE164)}</span>
                        {destination.recipientTaxId && (
                            <span className="mm-data block">CPF {formatCpf(destination.recipientTaxId)}</span>
                        )}
                        <span className="block">
                            {destination.addressLine1}
                            {destination.addressLine2 ? `, ${destination.addressLine2}` : ''}
                        </span>
                        {destination.district && <span className="block">{destination.district}</span>}
                        <span className="block">
                            {destination.locality}/{destination.administrativeArea} · {destination.postalCode} ·{' '}
                            {destination.countryCode}
                        </span>
                        {destination.deliveryInstructions && (
                            <span className="mt-1 block text-warm-700">
                                {t('packages.assembly.fields.deliveryInstructions')}: {destination.deliveryInstructions}
                            </span>
                        )}
                    </address>
                </InfoBlock>
                <InfoBlock title={t('packages.assembly.sections.shipping')}>
                    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                        <dt className="text-warm-600">{t('packages.assembly.fields.carrier')}</dt>
                        <dd className="m-0 font-semibold">
                            {sheet.carrier ?? t('common.dash')}
                            {sheet.carrierService ? ` · ${sheet.carrierService}` : ''}
                        </dd>
                        <dt className="text-warm-600">{t('packages.assembly.fields.tracking')}</dt>
                        <dd className="mm-data m-0 font-semibold">{sheet.trackingCode ?? t('common.dash')}</dd>
                        <dt className="text-warm-600">{t('packages.assembly.fields.weight')}</dt>
                        <dd className="mm-data m-0">
                            {sheet.weightGrams ? `${sheet.weightGrams} g` : t('packages.assembly.fields.notQuoted')}
                            {sheet.chargeableWeightGrams && sheet.chargeableWeightGrams !== sheet.weightGrams
                                ? ` (${sheet.chargeableWeightGrams} g)`
                                : ''}
                        </dd>
                        <dt className="text-warm-600">{t('packages.assembly.fields.dimensions')}</dt>
                        <dd className="mm-data m-0">
                            {hasDimensions
                                ? `${sheet.lengthMillimeters} × ${sheet.widthMillimeters} × ${sheet.heightMillimeters} mm`
                                : t('common.dash')}
                        </dd>
                    </dl>
                </InfoBlock>
            </section>

            <section>
                <SectionTitle>
                    {t('packages.assembly.sections.items')}
                    <span className="ml-2 font-normal text-warm-600">
                        {t('packages.assembly.summary.items', { count: sheet.items.length })} ·{' '}
                        {t('packages.assembly.summary.units', { count: units })} ·{' '}
                        {t('packages.assembly.summary.orders', { count: sheet.orders.length })}
                    </span>
                </SectionTitle>
                <table className="w-full border-collapse">
                    <caption className="sr-only">
                        {t('packages.assembly.sheetCaption', { code: sheet.packageCode })}
                    </caption>
                    <thead>
                        <tr className="border-b border-warm-950 text-left text-[10px] font-bold tracking-[.06em] text-warm-700 uppercase">
                            <th className="w-8 py-1.5 pr-2" scope="col">
                                {t('packages.assembly.columns.check')}
                            </th>
                            <th className="w-14 py-1.5 pr-2" scope="col">
                                {t('packages.assembly.columns.photo')}
                            </th>
                            <th className="py-1.5 pr-2" scope="col">
                                {t('packages.assembly.columns.product')}
                            </th>
                            <th className="w-28 py-1.5 pr-2" scope="col">
                                {t('packages.assembly.columns.order')}
                            </th>
                            <th className="w-12 py-1.5 pr-2 text-right" scope="col">
                                {t('packages.assembly.columns.quantity')}
                            </th>
                            <th className="w-28 py-1.5" scope="col">
                                {t('packages.assembly.columns.inspection')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sheet.items.map((item, index) => (
                            <ItemRow index={index + 1} item={item} key={item.id} order={ordersById.get(item.orderId)} />
                        ))}
                    </tbody>
                </table>
            </section>

            <section>
                <SectionTitle>{t('packages.assembly.sections.orders')}</SectionTitle>
                <ul className="m-0 grid list-none gap-2 p-0">
                    {sheet.orders.map((order) => (
                        <OrderBlock key={order.id} order={order} />
                    ))}
                </ul>
            </section>

            <section className="mt-auto border-t border-warm-950 pt-3 print:break-inside-avoid">
                <SectionTitle>{t('packages.assembly.sections.checklist')}</SectionTitle>
                <div className="grid grid-cols-4 gap-4">
                    <SignatureLine label={t('packages.assembly.checklist.assembledBy')} />
                    <SignatureLine label={t('packages.assembly.checklist.checkedBy')} />
                    <SignatureLine label={t('packages.assembly.checklist.date')} />
                    <SignatureLine label={t('packages.assembly.checklist.actualWeight')} />
                </div>
                <div className="mt-3">
                    <span className="block text-[10px] font-bold tracking-[.06em] text-warm-600 uppercase">
                        {t('packages.assembly.checklist.notes')}
                    </span>
                    <div className="mt-1 h-14 rounded border border-dashed border-warm-400" aria-hidden="true" />
                </div>
            </section>
        </article>
    );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="min-w-0 rounded border border-warm-300 p-2.5">
            <span className="block text-[10px] font-bold tracking-[.06em] text-warm-600 uppercase">{title}</span>
            <div className="mt-1 leading-relaxed">{children}</div>
        </div>
    );
}

function SectionTitle({ children }: { children: ReactNode }) {
    return <h3 className="mm-display m-0 mb-1.5 text-sm">{children}</h3>;
}

function SignatureLine({ label }: { label: string }) {
    return (
        <div>
            <div className="h-7 border-b border-warm-950" aria-hidden="true" />
            <span className="mt-1 block text-[10px] font-semibold text-warm-600">{label}</span>
        </div>
    );
}

interface ItemRowProps {
    index: number;
    item: AdminPackageAssemblyItem;
    order: AdminPackageAssemblyOrder | undefined;
}

function ItemRow({ index, item, order }: ItemRowProps) {
    const { t } = useTranslation();
    const { orderItem } = item;
    const origin =
        order?.fulfillmentMode === 'IN_STOCK'
            ? t('packages.assembly.item.inStock')
            : orderItem.marketplace
              ? t('packages.assembly.item.sourced', { marketplace: productSourceLabel(orderItem.marketplace) })
              : order
                ? t('packages.assembly.order.mode.SOURCED')
                : null;
    const decisionKey = item.inspection?.decision as 'KEEP' | 'REQUEST_ACTION' | 'REFUSE' | null | undefined;

    return (
        <tr className="border-b border-warm-300 align-top print:break-inside-avoid">
            <td className="py-2 pr-2">
                <span
                    className="grid h-5 w-5 place-items-center rounded border-2 border-warm-950 text-[9px] font-bold text-warm-500"
                    aria-hidden="true"
                >
                    {index}
                </span>
            </td>
            <td className="py-2 pr-2">
                <span className="grid h-12 w-12 place-items-center overflow-hidden rounded border border-warm-300 bg-warm-100">
                    {order?.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="h-full w-full object-cover" loading="eager" src={order.thumbnailUrl} />
                    ) : (
                        <ImageOff className="h-4 w-4 text-warm-500" aria-hidden="true" />
                    )}
                </span>
            </td>
            <td className="py-2 pr-2">
                <strong className="block text-xs leading-tight">{orderItem.productName}</strong>
                <span className="mt-0.5 block text-warm-700">
                    {[
                        item.variantLabel ? t('packages.assembly.item.variant', { label: item.variantLabel }) : null,
                        orderItem.size ? t('packages.assembly.item.size', { size: orderItem.size }) : null,
                        orderItem.category
                            ? t('packages.assembly.item.category', { name: orderItem.category.name })
                            : null,
                        origin,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
                {orderItem.marketplaceUrl && (
                    <span className="mm-data mt-0.5 block break-all text-[9px] text-warm-500">
                        {orderItem.marketplaceUrl}
                    </span>
                )}
            </td>
            <td className="py-2 pr-2">
                <Link
                    className="mm-data block font-semibold text-brand-700 no-underline hover:underline print:text-warm-950"
                    href={`/admin/pedidos/${item.orderId}`}
                >
                    {shortOrderId(item.orderId)}
                </Link>
                {order && <span className="block text-warm-700">{orderStatusLabel(order.status)}</span>}
            </td>
            <td className="py-2 pr-2 text-right">
                <strong className="mm-data block text-base leading-none">{item.quantity}</strong>
                {orderItem.quantity !== item.quantity && (
                    <span className="block text-[9px] text-warm-600">
                        {t('packages.assembly.item.requested', { count: orderItem.quantity })}
                    </span>
                )}
            </td>
            <td className="py-2">
                {item.inspection ? (
                    <>
                        <span className="block font-semibold">
                            {decisionKey
                                ? t(`packages.assembly.inspectionDecisions.${decisionKey}`)
                                : inspectionStatusLabel(item.inspection.status)}
                        </span>
                        {item.inspection.decisionNote && (
                            <span className="block text-warm-700">{item.inspection.decisionNote}</span>
                        )}
                    </>
                ) : (
                    <span className="text-warm-500">{t('packages.assembly.item.noInspection')}</span>
                )}
            </td>
        </tr>
    );
}

function OrderBlock({ order }: { order: AdminPackageAssemblyOrder }) {
    const { t } = useTranslation();
    const services = order.optionalServices.filter((service) => service.status !== 'CANCELLED');

    return (
        <li className="rounded border border-warm-300 p-2.5 print:break-inside-avoid">
            <div className="flex flex-wrap items-baseline gap-x-2">
                <Link
                    className="mm-data text-xs font-bold text-brand-700 no-underline hover:underline print:text-warm-950"
                    href={`/admin/pedidos/${order.id}`}
                >
                    {shortOrderId(order.id)}
                </Link>
                <span className="text-warm-700">{orderStatusLabel(order.status)}</span>
                <span className="text-warm-500">· {t(`packages.assembly.order.mode.${order.fulfillmentMode}`)}</span>
            </div>
            {order.adminDescription && (
                <p className="m-0 mt-1 whitespace-pre-line text-warm-800">
                    <span className="font-semibold">{t('packages.assembly.order.adminDescription')}:</span>{' '}
                    {order.adminDescription}
                </p>
            )}
            {services.length === 0 ? (
                <p className="m-0 mt-1 text-warm-500">{t('packages.assembly.order.noServices')}</p>
            ) : (
                <ul className="m-0 mt-1.5 grid list-none gap-1 p-0">
                    {services.map((service) => (
                        <li className="flex items-start gap-2" key={service.id}>
                            <span
                                className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm border-2 border-warm-950 text-[9px] leading-none font-bold ${
                                    service.status === 'COMPLETED' ? 'bg-warm-950 text-warm-50' : ''
                                }`}
                                aria-hidden="true"
                            >
                                {service.status === 'COMPLETED' ? '✓' : ''}
                            </span>
                            <span className="min-w-0">
                                <span className="font-semibold">
                                    {service.name}{' '}
                                    <span className="mm-data font-normal text-warm-700">
                                        {t('packages.assembly.order.serviceQuantity', { count: service.quantity })}
                                    </span>
                                </span>
                                <span className="ml-2 text-warm-600">
                                    {t(`packages.assembly.order.serviceStatus.${service.status}`)}
                                </span>
                                {service.customerNote && (
                                    <span className="block text-warm-800">
                                        {t('packages.assembly.order.customerNote', { note: service.customerNote })}
                                    </span>
                                )}
                                {service.adminNote && (
                                    <span className="block text-warm-800">
                                        {t('packages.assembly.order.adminNote', { note: service.adminNote })}
                                    </span>
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}
