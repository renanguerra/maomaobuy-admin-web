'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, LoaderCircle, Printer } from 'lucide-react';
import { Alert } from '@/components/admin/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useTranslation } from '@/i18n/LanguageProvider';
import { api } from '@/services/api';
import { recipientTaxIdLabel, type AddressSnapshot, type AdminPackage } from '@/types/api';
import type { CarrierShipment } from '@/types/carrier';

/**
 * Comprovante do frete pago à Westlink ("Proof of Freight Payment"), para o
 * cliente apresentar à Receita. Vai para fora da empresa, então leva só o que
 * a transportadora cobrou e os dados do envio: nada de custo cotado, margem,
 * frete cobrado do cliente, valor declarado, produtos, e-mail ou ids internos.
 * Decisão do dono (27/11/2026): texto fixo em inglês e chinês, sem o nome da
 * loja, datas no formato AAAA-MM-DD. Cores fixas, como nas outras folhas.
 */

/** Nomes de taxa que o ITS costuma devolver em chinês, com o nome em inglês. */
const FEE_NAMES: Record<string, string> = {
    运费: 'Freight',
    基本运费: 'Base freight',
    挂号费: 'Registration fee',
    处理费: 'Handling fee',
    操作费: 'Handling fee',
    燃油附加费: 'Fuel surcharge',
    燃油费: 'Fuel surcharge',
    附加费: 'Surcharge',
    偏远附加费: 'Remote area surcharge',
    超长附加费: 'Oversize surcharge',
    超重附加费: 'Overweight surcharge',
    关税: 'Import duty',
    税费: 'Taxes',
    保险费: 'Insurance',
};

function feeLabel(name: string) {
    const original = name.trim();
    const english = FEE_NAMES[original];
    return english ? `${english} ${original}` : original;
}

/** `CNY 207.63`: código da moeda, ponto decimal — leitura igual em inglês e chinês. */
function money(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' })
            .format(amount)
            .replace(/ /g, ' ');
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

/** `2026-11-27`, no dia de São Paulo. */
function day(value: string | Date | null) {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Sao_Paulo',
    }).format(new Date(value));
}

function kg(grams: number | null) {
    if (!grams) return null;
    return `${(grams / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`;
}

function cm(millimeters: number) {
    return (millimeters / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function addressLines(destination: AddressSnapshot): string[] {
    const street = [destination.addressLine1, destination.addressLine2].filter(Boolean).join(', ');
    const area = [destination.district, `${destination.locality} – ${destination.administrativeArea}`]
        .filter(Boolean)
        .join(', ');
    const postal =
        destination.countryCode === 'BR' && /^\d{8}$/.test(destination.postalCode)
            ? `${destination.postalCode.slice(0, 5)}-${destination.postalCode.slice(5)}`
            : destination.postalCode;
    return [street, area, `${postal} · ${destination.countryCode}`];
}

/** O envio que vale é o vivo e já faturado; cancelado não viajou. */
function billedShipment(shipments: CarrierShipment[]) {
    return shipments.find((shipment) => shipment.status === 'CREATED' && shipment.billed) ?? null;
}

export function FreightReceiptPage() {
    const { t } = useTranslation();
    const packageId = useSearchParams().get('pacote') ?? '';
    const [loaded, setLoaded] = useState<{ id: string; pkg: AdminPackage; shipment: CarrierShipment | null }>();
    const [failed, setFailed] = useState<string>();
    const [issuedAt] = useState(() => new Date());

    useEffect(() => {
        if (!packageId) return;
        let active = true;
        Promise.all([
            api<AdminPackage>(`/packages/${packageId}`),
            api<CarrierShipment[]>(`/packages/${packageId}/carrier-shipments`),
        ])
            .then(([pkg, shipments]) => {
                if (active) setLoaded({ id: packageId, pkg, shipment: billedShipment(shipments) });
            })
            .catch(() => {
                if (active) setFailed(packageId);
            });
        return () => {
            active = false;
        };
    }, [packageId]);

    const data = loaded?.id === packageId ? loaded : undefined;
    const error = failed === packageId;

    useEffect(() => {
        // Vira o nome do arquivo ao salvar em PDF.
        if (data) document.title = `Proof of Freight Payment ${data.pkg.packageCode}`;
    }, [data]);

    return (
        <div className="min-h-screen bg-warm-200 text-warm-950 print:bg-white">
            <header className="sticky top-0 z-10 border-b border-warm-300 bg-warm-50/95 backdrop-blur print:hidden">
                <div className="mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <ButtonLink
                        href={packageId ? `/admin/pacotes/${packageId}` : '/admin/pacotes'}
                        leadingIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
                        size="small"
                        variant="ghost"
                    >
                        {t('carrier.freightReceipt.back')}
                    </ButtonLink>
                    <Button
                        disabled={!data?.shipment}
                        leadingIcon={<Printer className="h-4 w-4" aria-hidden="true" />}
                        onClick={() => window.print()}
                        size="small"
                    >
                        {t('carrier.freightReceipt.print')}
                    </Button>
                </div>
            </header>

            <main className="mx-auto w-full max-w-[210mm] px-4 py-6 print:max-w-none print:p-0">
                {!packageId && (
                    <Alert tone="warning" title={t('carrier.freightReceipt.title')}>
                        <p>{t('carrier.freightReceipt.missingPackage')}</p>
                    </Alert>
                )}
                {error && (
                    <Alert tone="danger" title={t('common.errors.loadTitle')}>
                        <p>{t('carrier.freightReceipt.loadError')}</p>
                    </Alert>
                )}
                {packageId && !data && !error && (
                    <p className="flex items-center gap-3 py-16 text-sm font-semibold text-warm-600" aria-busy="true">
                        <LoaderCircle className="h-5 w-5 animate-spin text-brand-700" aria-hidden="true" />
                        {t('carrier.freightReceipt.loading')}
                    </p>
                )}
                {data && !data.shipment && (
                    <Alert tone="warning" title={t('carrier.freightReceipt.title')}>
                        <p>{t('carrier.freightReceipt.notBilled')}</p>
                    </Alert>
                )}
                {data?.shipment && <Receipt issuedAt={issuedAt} pkg={data.pkg} shipment={data.shipment} />}
            </main>
        </div>
    );
}

function Receipt({ pkg, shipment, issuedAt }: { pkg: AdminPackage; shipment: CarrierShipment; issuedAt: Date }) {
    const billed = shipment.billed!;
    const total = money(Number(billed.amountMinor) / 100, billed.currency);
    const dimensions =
        pkg.lengthMillimeters && pkg.widthMillimeters && pkg.heightMillimeters
            ? `${cm(pkg.lengthMillimeters)} × ${cm(pkg.widthMillimeters)} × ${cm(pkg.heightMillimeters)} cm`
            : null;
    const fees = billed.fees.filter((fee) => fee.amount > 0);

    return (
        <article className="grid gap-6 rounded-lg border border-warm-300 bg-white p-[14mm] text-[12px] leading-snug text-warm-950 shadow-sm print:rounded-none print:border-0 print:p-[6mm] print:shadow-none">
            <header className="flex items-end justify-between gap-4 border-b-2 border-warm-950 pb-3">
                <h1 className="m-0 leading-tight">
                    <span className="block text-xl font-bold">Proof of Freight Payment</span>
                    <span className="mt-1 block text-base font-semibold text-warm-700">运费支付证明</span>
                </h1>
                <dl className="m-0 grid grid-cols-[auto_auto] gap-x-2 text-right text-[11px] text-warm-700">
                    <dt>No. / 编号</dt>
                    <dd className="mm-data m-0 font-bold text-warm-950">{pkg.packageCode}</dd>
                    <dt>Date / 日期</dt>
                    <dd className="mm-data m-0 font-bold text-warm-950">{day(issuedAt)}</dd>
                </dl>
            </header>

            <div className="grid gap-1.5 text-[13px]">
                <p className="m-0">
                    This document certifies that the international freight for shipment{' '}
                    <strong className="mm-data">{pkg.packageCode}</strong>, from China to the consignee below, was
                    charged by the carrier <strong>Westlink</strong> in the amount of{' '}
                    <strong className="mm-data">{total}</strong>.
                </p>
                <p className="m-0 text-warm-700">
                    兹证明，货件 <span className="mm-data">{pkg.packageCode}</span>{' '}
                    自中国寄往下列收件人的国际运费已由承运商 Westlink（西游跨境）收取，金额为{' '}
                    <span className="mm-data">{total}</span>。
                </p>
            </div>

            <Block title="Shipment / 运输信息">
                <Rows
                    rows={[
                        ['Carrier / 承运商', 'Westlink (西游跨境)'],
                        ['Service / 渠道', shipment.channelCode],
                        ['Order No. / 客户单号', shipment.customerOrderNo],
                        ['Waybill No. / 运单号', shipment.waybillNo],
                        ['Last-mile carrier / 尾程承运商', shipment.lastMileCarrier],
                        ['Tracking No. / 追踪号', shipment.trackingNumber],
                        ['Shipped on / 发货日期', day(pkg.shippedAt)],
                        ['Delivered on / 签收日期', day(pkg.deliveredAt)],
                    ]}
                />
            </Block>

            <Block title="Consignee / 收件人">
                <Rows
                    rows={[
                        ['Name / 姓名', pkg.destination.recipientCompanyName ?? pkg.destination.recipientFullName],
                        ...(pkg.destination.recipientCompanyName
                            ? ([['Attention / 联系人', pkg.destination.recipientFullName]] as Array<[string, string]>)
                            : []),
                        ['Tax ID / 税号', recipientTaxIdLabel(pkg.destination)],
                        ['Address / 地址', addressLines(pkg.destination).join('\n')],
                    ]}
                />
            </Block>

            <Block title="Parcel / 包裹">
                <Rows
                    rows={[
                        ['Weight / 重量', kg(pkg.weightGrams)],
                        ['Dimensions / 尺寸', dimensions],
                        ['Chargeable weight / 计费重量', kg(billed.weightGrams)],
                    ]}
                />
            </Block>

            <Block title="Freight charges / 运费明细">
                <table className="w-full border-collapse">
                    <tbody>
                        {fees.map((fee, index) => (
                            <tr className="border-b border-warm-300" key={`${fee.name}-${index}`}>
                                <td className="py-1.5">{feeLabel(fee.name)}</td>
                                <td className="mm-data py-1.5 text-right whitespace-nowrap">
                                    {money(fee.amount, fee.currency)}
                                </td>
                            </tr>
                        ))}
                        <tr className="border-t-2 border-warm-950 font-bold">
                            <td className="py-1.5">Total paid / 实付合计</td>
                            <td className="mm-data py-1.5 text-right text-[14px] whitespace-nowrap">{total}</td>
                        </tr>
                    </tbody>
                </table>
                {billed.billedAt && (
                    <p className="m-0 mt-1.5 text-[11px] text-warm-700">
                        Charged on / 扣费日期: <span className="mm-data">{day(billed.billedAt)}</span>
                    </p>
                )}
            </Block>

            <footer className="grid gap-1 border-t border-warm-400 pt-3 text-[11px] text-warm-700">
                <p className="m-0">
                    Amount charged by Westlink for the international transport of this shipment, as per the
                    carrier&apos;s invoice. Brazilian import taxes are not included.
                </p>
                <p className="m-0">本金额为 Westlink 按账单收取的本票国际运输费用，不含巴西进口税费。</p>
            </footer>
        </article>
    );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="break-inside-avoid-page">
            <h2 className="m-0 mb-1.5 border-b border-warm-400 pb-1 text-[11px] font-bold tracking-[.06em] uppercase">
                {title}
            </h2>
            {children}
        </section>
    );
}

/** Linha sem valor some: o comprovante não mostra campo vazio. */
function Rows({ rows }: { rows: Array<[string, string | null | undefined]> }) {
    return (
        <dl className="m-0 grid grid-cols-[minmax(0,15rem)_1fr] gap-x-4 gap-y-1">
            {rows
                .filter((row): row is [string, string] => Boolean(row[1]))
                .map(([label, value]) => (
                    <div className="contents" key={label}>
                        <dt className="text-warm-700">{label}</dt>
                        <dd className="m-0 whitespace-pre-line">{value}</dd>
                    </div>
                ))}
        </dl>
    );
}
