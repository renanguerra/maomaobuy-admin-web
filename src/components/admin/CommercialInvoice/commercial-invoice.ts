import type { Worksheet } from 'exceljs';

/**
 * Commercial invoice do pacote, para as empresas que despacham por FedEx e
 * DHL. Há dois modelos: `DETAILED` segue a planilha de exportação de 2026
 * (rótulos em inglês e chinês) e `SIMPLE` segue o invoice da Starlink para o
 * Brasil. Campos que não valem para o Brasil ficaram de fora (EORI, códigos
 * de plataforma, condições de cotação). Só o que vai no papel mora aqui; a
 * tela é o `CommercialInvoiceDialog`.
 */

export type InvoiceModel = 'DETAILED' | 'SIMPLE';

export interface InvoiceParty {
    company: string;
    address: string;
    postalCode: string;
    attention: string;
    phone: string;
}

export interface InvoiceConsignee extends InvoiceParty {
    email: string;
    /** CPF ou CNPJ, já com o rótulo decidido em `taxIdLabel`. */
    taxId: string;
    taxIdLabel: string;
    stateRegistration: string;
}

export interface InvoiceItem {
    chineseName: string;
    description: string;
    brand: string;
    electricMagnetic: string;
    hsCode: string;
    purpose: string;
    material: string;
    quantity: number;
    unitValueCents: number;
}

export interface CommercialInvoice {
    invoiceNumber: string;
    date: string;
    waybillNumber: string;
    shipper: InvoiceParty;
    consignee: InvoiceConsignee;
    items: InvoiceItem[];
    numberOfUnits: number;
    shippingWay: string;
    terms: string;
    freightCents: number;
    reasonForExport: string;
}

/** Exportador padrão, como está no invoice da Starlink. */
export const DEFAULT_SHIPPER: InvoiceParty = {
    company: 'Qingdao Starlink Technologies Co., Ltd',
    address: '2 / F, East Office Building, No. 45 Beijing Road, Qianwan Free Trade Port Area, Qingdao, China',
    postalCode: '',
    attention: '',
    phone: '',
};

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function invoiceItemsTotalCents(items: Pick<InvoiceItem, 'quantity' | 'unitValueCents'>[]): number {
    return items.reduce((total, item) => total + item.quantity * item.unitValueCents, 0);
}

export function invoiceFileName(packageCode: string): string {
    return `commercial-invoice-${packageCode}.xlsx`;
}

const DETAILED_WIDTHS = [9, 16, 30, 13, 11, 14, 16, 12, 8, 12, 13];
const DETAILED_HEADERS: [string, string][] = [
    ['总件数', 'No.of units'],
    ['中文品名', 'Product name'],
    ['货物描述', 'Description'],
    ['品牌名称', 'Brand'],
    ['是否带电/磁', 'Electric/Magnetic'],
    ['10位数海关编码', 'HS'],
    ['详细用途', 'Purpose'],
    ['材质', 'Material'],
    ['数量', 'QTY(PCS)'],
    ['单价', 'Unit Value(USD)'],
    ['总价', 'Total value (USD)'],
];
const SIMPLE_WIDTHS = [8, 20, 46, 8, 8, 13, 14];
const SIMPLE_HEADERS = [
    'Item No.',
    'Item',
    'DESCRIPTION OF PRODUCT',
    'QTY',
    'UNIT',
    'UNIT PRICE (USD)',
    'TOTAL PRICE (USD)',
];
const USD_FORMAT = '#,##0.00';
const THIN = { style: 'thin' } as const;
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function band(sheet: Worksheet, row: number, from: number, to: number, value: string | number, bold = false) {
    if (to > from) sheet.mergeCells(row, from, row, to);
    const cell = sheet.getCell(row, from);
    cell.value = value;
    cell.font = { bold, size: 10 };
    cell.alignment = { vertical: 'middle', wrapText: true };
    for (let column = from; column <= to; column += 1) sheet.getCell(row, column).border = BORDER;
    return cell;
}

function fillDetailed(sheet: Worksheet, invoice: CommercialInvoice) {
    const last = DETAILED_WIDTHS.length;
    sheet.columns = DETAILED_WIDTHS.map((width) => ({ width }));

    band(sheet, 1, 1, last, 'Commercial Invoice', true).font = { bold: true, size: 16 };
    sheet.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;
    band(sheet, 2, 1, 4, `Invoice No. (发票号): ${invoice.invoiceNumber}`, true);
    band(sheet, 2, 5, 7, `Date (日期): ${invoice.date}`, true);
    band(sheet, 2, 8, last, `运单号 Waybill No: ${invoice.waybillNumber}`, true);
    band(sheet, 3, 1, 5, "发货人 Shipper's information", true);
    band(sheet, 3, 6, last, "收货人 Contact's information", true);

    const { shipper, consignee } = invoice;
    const shipperRows: [string, string][] = [
        ['Company (发件公司)', shipper.company],
        ['ADD (发件地址)', shipper.address],
        ['Postcode (邮编)', shipper.postalCode],
        ['Attn (发件人)', shipper.attention],
        ['Tel (电话)', shipper.phone],
        ['', ''],
        ['', ''],
        ['', ''],
    ];
    const consigneeRows: [string, string][] = [
        ['Company (收件公司)', consignee.company],
        ['ADD (收件地址)', consignee.address],
        ['Postcode (邮编)', consignee.postalCode],
        ['Attn (收件人)', consignee.attention],
        ['Tel (电话)', consignee.phone],
        ['Email (邮箱)', consignee.email],
        [`${consignee.taxIdLabel} (税号)`, consignee.taxId],
        ['IE', consignee.stateRegistration],
    ];
    shipperRows.forEach(([label, value], index) => {
        const row = 4 + index;
        band(sheet, row, 1, 2, label);
        band(sheet, row, 3, 5, value);
        band(sheet, row, 6, 7, consigneeRows[index][0]);
        band(sheet, row, 8, last, consigneeRows[index][1]);
    });
    sheet.getRow(5).height = 42;

    const headerRow = 12;
    DETAILED_HEADERS.forEach(([chinese, english], index) => {
        const cell = band(sheet, headerRow, index + 1, index + 1, `${chinese}\n${english}`, true);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    sheet.getRow(headerRow).height = 44;

    const firstItemRow = headerRow + 1;
    invoice.items.forEach((item, index) => {
        const row = firstItemRow + index;
        [
            '',
            item.chineseName,
            item.description,
            item.brand,
            item.electricMagnetic,
            item.hsCode,
            item.purpose,
            item.material,
            item.quantity,
            item.unitValueCents / 100,
        ].forEach((value, position) => band(sheet, row, position + 1, position + 1, value));
        sheet.getCell(row, 10).numFmt = USD_FORMAT;
        const total = band(sheet, row, 11, 11, 0);
        total.value = { formula: `I${row}*J${row}`, result: (item.quantity * item.unitValueCents) / 100 };
        total.numFmt = USD_FORMAT;
        sheet.getRow(row).height = 32;
    });
    const lastItemRow = firstItemRow + invoice.items.length - 1;
    if (lastItemRow > firstItemRow) sheet.mergeCells(firstItemRow, 1, lastItemRow, 1);
    const units = sheet.getCell(firstItemRow, 1);
    units.value = invoice.numberOfUnits;
    units.alignment = { horizontal: 'center', vertical: 'middle' };

    const totalRow = lastItemRow + 1;
    band(sheet, totalRow, 1, 4, `Shipment terms (成交方式): ${invoice.terms}`, true);
    band(sheet, totalRow, 5, 6, '申报运费 Freight (USD)', true);
    band(sheet, totalRow, 7, 7, invoice.freightCents / 100).numFmt = USD_FORMAT;
    band(sheet, totalRow, 8, 10, 'Total Invoice Value (总价值):', true).alignment = {
        horizontal: 'right',
        vertical: 'middle',
    };
    const grandTotal = band(sheet, totalRow, 11, 11, 0, true);
    grandTotal.value = {
        formula: `SUM(K${firstItemRow}:K${lastItemRow})+G${totalRow}`,
        result: (invoiceItemsTotalCents(invoice.items) + invoice.freightCents) / 100,
    };
    grandTotal.numFmt = USD_FORMAT;

    band(sheet, totalRow + 1, 1, 6, 'Origin: China (原产国)');
    band(sheet, totalRow + 1, 7, last, `Reason for export: ${invoice.reasonForExport}`);
    band(
        sheet,
        totalRow + 2,
        1,
        last,
        'DECLARE ALL THE INFORMATION CONTAINED IN THIS INVOICE TO BE TRUE AND CORRECT; 本人谨此声明本发票信息真实及正确无误！',
        true,
    );
    band(sheet, totalRow + 3, 1, 2, 'Signature (签名)');
    band(sheet, totalRow + 3, 3, 5, '');
    band(sheet, totalRow + 3, 6, 7, 'Date (日期)');
    band(sheet, totalRow + 3, 8, last, invoice.date);
    sheet.getRow(totalRow + 3).height = 40;
}

function fillSimple(sheet: Worksheet, invoice: CommercialInvoice) {
    const last = SIMPLE_WIDTHS.length;
    sheet.columns = SIMPLE_WIDTHS.map((width) => ({ width }));
    const { shipper, consignee } = invoice;
    let row = 1;

    function centered(value: string, size: number) {
        const cell = band(sheet, row, 1, last, value, true);
        cell.font = { bold: true, size };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        row += 1;
    }

    if (shipper.company) centered(shipper.company, 14);
    if (shipper.address) {
        centered(`ADD: ${shipper.address}`, 10);
        sheet.getRow(row - 1).height = 30;
    }
    centered('COMMERCIAL INVOICE', 14);

    const contact =
        consignee.company === consignee.attention ? consignee.company : `${consignee.company} / ${consignee.attention}`;
    [
        `Contact: ${contact}`,
        `Add: ${consignee.address}`,
        `TEL: ${consignee.phone}`,
        `Zip code: ${consignee.postalCode}`,
        `ID FISCAL: ${consignee.taxId}`,
        consignee.stateRegistration && `IE: ${consignee.stateRegistration}`,
        `Email: ${consignee.email}`,
        `Shipping ways: ${invoice.shippingWay}`,
        `Terms of Delivery: ${invoice.terms}`,
        `Date: ${invoice.date}`,
        `Invoice No.: ${invoice.invoiceNumber}`,
        invoice.waybillNumber && `Waybill No.: ${invoice.waybillNumber}`,
    ].forEach((line) => {
        if (!line) return;
        band(sheet, row, 1, last, line);
        row += 1;
    });

    SIMPLE_HEADERS.forEach((header, index) => {
        const cell = band(sheet, row, index + 1, index + 1, header, true);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    sheet.getRow(row).height = 30;
    row += 1;

    const firstItemRow = row;
    function line(item: string, description: string, quantity: number, unit: string, unitValueCents: number) {
        [row - firstItemRow + 1, item, description, quantity, unit, unitValueCents / 100].forEach((value, position) =>
            band(sheet, row, position + 1, position + 1, value),
        );
        sheet.getCell(row, 6).numFmt = USD_FORMAT;
        const total = band(sheet, row, 7, 7, 0);
        total.value = { formula: `D${row}*F${row}`, result: (quantity * unitValueCents) / 100 };
        total.numFmt = USD_FORMAT;
        row += 1;
    }

    invoice.items.forEach((item) => {
        const description = [
            item.description.toUpperCase(),
            `HS CODE ${item.hsCode}`,
            `MATERIAL: ${item.material.toUpperCase()}`,
            `USE: ${item.purpose.toUpperCase()}`,
        ].join('\n');
        line(item.description.toUpperCase(), description, item.quantity, 'pc', item.unitValueCents);
        sheet.getRow(row - 1).height = 58;
    });
    if (invoice.freightCents > 0)
        line('EXPRESS COST', 'From China to Brazil by Express', 1, 'bill', invoice.freightCents);

    band(sheet, row, 1, last - 1, 'TOTAL (USD)', true).alignment = { horizontal: 'right', vertical: 'middle' };
    const grandTotal = band(sheet, row, last, last, 0, true);
    grandTotal.value = {
        formula: `SUM(G${firstItemRow}:G${row - 1})`,
        result: (invoiceItemsTotalCents(invoice.items) + invoice.freightCents) / 100,
    };
    grandTotal.numFmt = USD_FORMAT;
    row += 1;

    band(sheet, row, 1, last, 'I DECLARE THAT THE ABOVE INFORMATION IS TRUE AND CORRECT TO THE BEST OF MY KNOWLEDGE');
    band(sheet, row + 1, 1, last, `REASON FOR EXPORT: ${invoice.reasonForExport}`);
    band(sheet, row + 2, 1, 3, 'Buyer:');
    band(sheet, row + 2, 4, last, 'Signature:');
    sheet.getRow(row + 2).height = 40;
}

/** Gera o .xlsx. O exceljs só carrega aqui, para não pesar na tela do pacote. */
export async function buildCommercialInvoiceFile(invoice: CommercialInvoice, model: InvoiceModel): Promise<Blob> {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Commercial Invoice', {
        pageSetup: {
            paperSize: 9,
            orientation: model === 'DETAILED' ? 'landscape' : 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
        },
    });
    if (model === 'DETAILED') fillDetailed(sheet, invoice);
    else fillSimple(sheet, invoice);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: XLSX_MIME_TYPE });
}
