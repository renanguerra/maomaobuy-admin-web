import type { Worksheet } from 'exceljs';

/**
 * Commercial invoice do pacote, para as empresas que despacham por FedEx e
 * DHL. Há três modelos: `DETAILED` segue a planilha de exportação de 2026
 * (rótulos em inglês e chinês), `SIMPLE` segue o invoice da Starlink para o
 * Brasil e `ABC_LEO` segue o modelo bilíngue da ABC Leo (sem linha de frete). Campos que não valem para o Brasil ficaram de fora (EORI, códigos
 * de plataforma, condições de cotação). Só o que vai no papel mora aqui; a
 * tela é o `CommercialInvoiceDialog`.
 */

export type InvoiceModel = 'DETAILED' | 'SIMPLE' | 'ABC_LEO';

/** Modelos que levam o frete declarado; o ABC Leo soma só a mercadoria. */
export function invoiceIncludesFreight(model: InvoiceModel): boolean {
    return model !== 'ABC_LEO';
}

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
    /** País de destino em inglês, como "Brazil". */
    destinationCountry: string;
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

// Colunas A–I do modelo ABC Leo; J é só margem.
const ABC_LEO_WIDTHS = [14, 8, 14, 15, 14, 7, 7, 9, 16, 2];

function fillAbcLeo(sheet: Worksheet, invoice: CommercialInvoice) {
    sheet.columns = ABC_LEO_WIDTHS.map((width) => ({ width }));
    const { shipper, consignee } = invoice;

    function cell(row: number, from: number, to: number, value: string | number, size = 10) {
        const target = band(sheet, row, from, to, value);
        target.font = { size };
        return target;
    }
    function center(row: number, from: number, to: number, value: string | number, size = 10) {
        const target = cell(row, from, to, value, size);
        target.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        return target;
    }

    sheet.mergeCells(1, 1, 1, 9);
    sheet.mergeCells(2, 1, 2, 9);
    const title = sheet.getCell(1, 1);
    title.value = 'Commercial Invoice';
    title.font = { size: 16 };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    const titleChinese = sheet.getCell(2, 1);
    titleChinese.value = '商业发票';
    titleChinese.font = { size: 16 };
    titleChinese.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 22;
    sheet.getRow(2).height = 22;
    sheet.getCell(3, 8).value = 'No.';
    sheet.getCell(3, 9).value = invoice.invoiceNumber;
    sheet.getCell(3, 8).alignment = { horizontal: 'center' };
    sheet.getCell(3, 9).alignment = { horizontal: 'center' };

    cell(4, 1, 3, 'International Air Waybill No.:');
    cell(4, 4, 4, '');
    cell(4, 5, 7, 'Date of Exportation');
    cell(4, 8, 9, '');
    cell(5, 1, 2, '运单号：');
    cell(5, 3, 4, invoice.waybillNumber);
    cell(5, 5, 6, '出口日期：');
    center(5, 7, 9, invoice.date);
    cell(6, 1, 4, 'Shipper/Exporter (complete name and address)');
    cell(6, 5, 9, 'Consignee (complete name and address)');

    const consigneeDetails = [
        `ADD: ${consignee.address}`,
        consignee.taxId && `${consignee.taxIdLabel}: ${consignee.taxId}`,
        consignee.stateRegistration && `IE: ${consignee.stateRegistration}`,
        consignee.email && `Email: ${consignee.email}`,
    ]
        .filter(Boolean)
        .join('\n');
    const partyRows: [string, string, string][] = [
        ['COMPANY:', shipper.company, consignee.company],
        ['ATTN:', shipper.attention, consignee.attention],
    ];
    partyRows.forEach(([label, shipperValue, consigneeValue], index) => {
        const row = 7 + index;
        cell(row, 1, 1, label);
        cell(row, 2, 4, shipperValue);
        cell(row, 5, 5, label);
        cell(row, 6, 9, consigneeValue);
        sheet.getRow(row).height = 32;
    });
    sheet.mergeCells(9, 1, 11, 4);
    sheet.mergeCells(9, 5, 11, 9);
    const shipperAddress = cell(9, 1, 1, shipper.address ? `ADD: ${shipper.address}` : '');
    shipperAddress.alignment = { vertical: 'top', wrapText: true };
    const consigneeAddress = cell(9, 5, 5, consigneeDetails);
    consigneeAddress.alignment = { vertical: 'top', wrapText: true };
    for (let row = 9; row <= 11; row += 1)
        for (let column = 1; column <= 9; column += 1) sheet.getCell(row, column).border = BORDER;
    sheet.getRow(9).height = 30;
    sheet.getRow(10).height = 30;
    sheet.getRow(11).height = 30;
    [
        ['TEL:', shipper.phone, consignee.phone],
        ['POSTAL CODE:', shipper.postalCode, consignee.postalCode],
    ].forEach(([label, shipperValue, consigneeValue], index) => {
        const row = 12 + index;
        cell(row, 1, 1, label);
        cell(row, 2, 4, shipperValue);
        cell(row, 5, 5, label);
        cell(row, 6, 9, consigneeValue);
    });

    cell(14, 1, 3, 'Country of Origin');
    center(14, 4, 6, 'Country of Export');
    center(14, 7, 9, 'Country of destination');
    center(15, 1, 2, '原产国');
    center(15, 3, 3, 'CHINA');
    center(15, 4, 4, '出口国');
    center(15, 5, 6, 'CHINA');
    center(15, 7, 8, '进口国');
    center(15, 9, 9, invoice.destinationCountry.toUpperCase());

    center(16, 1, 4, 'Description of Goods');
    center(16, 5, 6, 'Qty');
    center(16, 7, 8, 'Unit Value');
    center(16, 9, 9, 'Total Value');
    center(17, 1, 4, '货物描述');
    center(17, 5, 6, '数量');
    center(17, 7, 8, '单价');
    center(17, 9, 9, '总价');

    const firstItemRow = 18;
    invoice.items.forEach((item, index) => {
        const row = firstItemRow + index;
        const description = [item.description.toUpperCase(), `HS ${item.hsCode}`, item.material, item.purpose]
            .filter(Boolean)
            .join('. ');
        center(row, 1, 4, description);
        center(row, 5, 5, item.quantity);
        center(row, 6, 6, 'PCS');
        center(row, 7, 7, 'USD');
        center(row, 8, 8, item.unitValueCents / 100).numFmt = USD_FORMAT;
        const total = center(row, 9, 9, 0);
        total.value = { formula: `E${row}*H${row}`, result: (item.quantity * item.unitValueCents) / 100 };
        total.numFmt = USD_FORMAT;
        sheet.getRow(row).height = 32;
    });
    const lastItemRow = firstItemRow + invoice.items.length - 1;

    const totalRow = lastItemRow + 1;
    sheet.mergeCells(totalRow, 1, totalRow, 4);
    sheet.mergeCells(totalRow, 5, totalRow, 8);
    sheet.mergeCells(totalRow + 1, 6, totalRow + 1, 8);
    sheet.mergeCells(totalRow, 9, totalRow + 3, 9);
    const cartons = sheet.getCell(totalRow, 1);
    cartons.value = `TOTAL: (${invoice.numberOfUnits}) Carton${invoice.numberOfUnits === 1 ? '' : 's'} ONLY`;
    cartons.font = { size: 10 };
    const totalLabel = sheet.getCell(totalRow, 5);
    totalLabel.value = 'Total Invoice Value:';
    totalLabel.font = { size: 12 };
    totalLabel.alignment = { horizontal: 'center' };
    const totalChinese = sheet.getCell(totalRow + 1, 6);
    totalChinese.value = '总价值';
    totalChinese.font = { size: 12 };
    totalChinese.alignment = { horizontal: 'center' };
    const grandTotal = sheet.getCell(totalRow, 9);
    grandTotal.value = {
        formula: `SUM(I${firstItemRow}:I${lastItemRow})`,
        result: invoiceItemsTotalCents(invoice.items) / 100,
    };
    grandTotal.numFmt = USD_FORMAT;
    grandTotal.font = { size: 10 };
    grandTotal.alignment = { horizontal: 'center', vertical: 'middle' };
    grandTotal.border = BORDER;

    const signatureRow = totalRow + 4;
    sheet.getCell(signatureRow, 1).value = "Shipper's Signature & Stamp";
    sheet.mergeCells(signatureRow + 1, 1, signatureRow + 1, 3);
    sheet.getCell(signatureRow + 1, 1).value = '发件人签字、盖章';
    sheet.getRow(signatureRow + 2).height = 30;

    // Moldura do rodapé, como no modelo: só as bordas de fora.
    const lastRow = signatureRow + 2;
    for (let row = totalRow; row <= lastRow; row += 1) {
        for (let column = 1; column <= 9; column += 1) {
            if (column === 9 && row < totalRow + 4) continue;
            const target = sheet.getCell(row, column);
            target.border = {
                ...(row === totalRow && { top: THIN }),
                ...(row === lastRow && { bottom: THIN }),
                ...(column === 1 && { left: THIN }),
                ...(column === 9 && { right: THIN }),
            };
        }
    }
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
    else if (model === 'ABC_LEO') fillAbcLeo(sheet, invoice);
    else fillSimple(sheet, invoice);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: XLSX_MIME_TYPE });
}
