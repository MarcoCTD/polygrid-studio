import ExcelJS from 'exceljs';
import {
  EUER_DATE_SOURCE_LABELS,
  KLEINUNTERNEHMER_GRENZE_LAUFEND_EUR,
  KLEINUNTERNEHMER_GRENZE_VORJAHR_EUR,
  type EuerExpenseLine,
  type EuerIncomeLine,
  type EuerYearReport,
} from './euerYear';

/**
 * Excel-Generierung für den EÜR-Jahresexport (Modul 14, Spec Abschnitt 3).
 * Vier Sheets: Übersicht, Einnahmen, Ausgaben, Monatsübersicht.
 * Summen werden als berechnete Werte geschrieben (identisch zum Report),
 * damit Vorschau und Datei garantiert übereinstimmen.
 */

export interface EuerWorkbookMeta {
  companyName: string;
  createdAt?: Date;
}

const EUR_FORMAT = '#,##0.00 "€"';
const DATE_FORMAT = 'dd.mm.yyyy';

export const EUER_DISCLAIMER =
  'Dieser Export ersetzt keine steuerliche Beratung. Erstellt mit PolyGrid Studio ' +
  'für Kleinunternehmer nach §19 UStG (Bruttobeträge, keine Umsatzsteuer). ' +
  'Alle Werte vor Abgabe prüfen bzw. durch den Steuerberater prüfen lassen.';

export const EUER_AFA_HINWEIS =
  'Hinweis: Anschaffungen über 800 EUR netto sind ggf. über die Nutzungsdauer ' +
  'abzuschreiben (AfA). Dieser Export weist alle Ausgaben im Zahlungsjahr voll aus – ' +
  'bitte vom Steuerberater prüfen lassen.';

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

function isoToDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function boldRow(row: ExcelJS.Row): void {
  row.font = { bold: true };
}

function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function makePrintable(sheet: ExcelJS.Worksheet): void {
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

function addSectionTitle(sheet: ExcelJS.Worksheet, title: string): void {
  sheet.addRow([]);
  boldRow(sheet.addRow([title]));
}

function buildOverviewSheet(
  workbook: ExcelJS.Workbook,
  report: EuerYearReport,
  meta: EuerWorkbookMeta,
  createdAt: Date,
): void {
  const sheet = workbook.addWorksheet('Übersicht');
  makePrintable(sheet);
  setColumnWidths(sheet, [44, 20]);

  const title = sheet.addRow([`Einnahmen-Überschuss-Rechnung ${report.year}`]);
  title.font = { bold: true, size: 14 };
  sheet.addRow([meta.companyName]);
  const created = sheet.addRow(['Erstellt am', createdAt]);
  created.getCell(2).numFmt = DATE_FORMAT;
  sheet.addRow(['Kleinunternehmer nach §19 UStG – keine Umsatzsteuer, Bruttobeträge']);

  addSectionTitle(sheet, 'Summen');
  const incomeRow = sheet.addRow(['Einnahmen', report.incomeTotal]);
  incomeRow.getCell(2).numFmt = EUR_FORMAT;

  for (const group of report.expenseGroups) {
    const row = sheet.addRow([`Ausgaben – ${group.categoryLabel}`, group.subtotal]);
    row.getCell(2).numFmt = EUR_FORMAT;
  }
  const expenseRow = sheet.addRow(['Ausgaben gesamt (steuerrelevant)', report.expenseTotal]);
  boldRow(expenseRow);
  expenseRow.getCell(2).numFmt = EUR_FORMAT;

  const surplusRow = sheet.addRow(['Überschuss (Einnahmen − Ausgaben)', report.surplus]);
  surplusRow.font = { bold: true, size: 12 };
  surplusRow.getCell(2).numFmt = EUR_FORMAT;

  addSectionTitle(sheet, 'Nachrichtlich (nicht in den Summen enthalten)');
  const excludedRow = sheet.addRow([
    `Refundierte/strittige Aufträge (${report.excludedIncome.length})`,
    report.excludedIncomeTotal,
  ]);
  excludedRow.getCell(2).numFmt = EUR_FORMAT;
  const nonTaxRow = sheet.addRow([
    `Nicht steuerrelevante Ausgaben (${report.nonTaxRelevantLines.length})`,
    report.nonTaxRelevantTotal,
  ]);
  nonTaxRow.getCell(2).numFmt = EUR_FORMAT;

  addSectionTitle(sheet, 'Hinweise');
  const afa = sheet.addRow([EUER_AFA_HINWEIS]);
  afa.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  const disclaimer = sheet.addRow([EUER_DISCLAIMER]);
  disclaimer.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  sheet.addRow([
    `Kleinunternehmergrenzen (Gesetzesstand 2025): ${KLEINUNTERNEHMER_GRENZE_VORJAHR_EUR.toLocaleString('de-DE')} € Vorjahr / ${KLEINUNTERNEHMER_GRENZE_LAUFEND_EUR.toLocaleString('de-DE')} € laufendes Jahr.`,
  ]);
}

const INCOME_HEADERS = [
  'Datum',
  'Datumsquelle',
  'Plattform',
  'Bestellnummer',
  'Produkt',
  'Menge',
  'Betrag',
] as const;

function addIncomeLine(sheet: ExcelJS.Worksheet, line: EuerIncomeLine): void {
  const row = sheet.addRow([
    isoToDate(line.date),
    EUER_DATE_SOURCE_LABELS[line.dateSource],
    line.platform,
    line.orderNumber,
    line.product,
    line.quantity,
    line.amount,
  ]);
  row.getCell(1).numFmt = DATE_FORMAT;
  row.getCell(7).numFmt = EUR_FORMAT;
}

function buildIncomeSheet(workbook: ExcelJS.Workbook, report: EuerYearReport): void {
  const sheet = workbook.addWorksheet('Einnahmen');
  makePrintable(sheet);
  setColumnWidths(sheet, [12, 22, 14, 20, 30, 8, 14]);

  boldRow(sheet.addRow([...INCOME_HEADERS]));
  for (const line of report.incomeLines) {
    addIncomeLine(sheet, line);
  }
  const totalRow = sheet.addRow(['Summe Einnahmen', '', '', '', '', '', report.incomeTotal]);
  boldRow(totalRow);
  totalRow.getCell(7).numFmt = EUR_FORMAT;

  if (report.excludedIncome.length > 0) {
    addSectionTitle(sheet, 'Nicht enthalten (refundiert/strittig) – nicht in der Summe');
    for (const line of report.excludedIncome) {
      addIncomeLine(sheet, line);
      const statusCell = sheet.lastRow?.getCell(2);
      if (statusCell) {
        statusCell.value = line.paymentStatus === 'refunded' ? 'Refundiert' : 'Strittig';
      }
    }
  }
}

const EXPENSE_HEADERS = [
  'Datum',
  'Händler',
  'Kategorie',
  'Unterkategorie',
  'Zweck',
  'Beleg',
  'Betrag',
] as const;

function addExpenseLine(sheet: ExcelJS.Worksheet, line: EuerExpenseLine): void {
  const row = sheet.addRow([
    isoToDate(line.date),
    line.vendor,
    line.categoryLabel,
    line.subcategoryLabel,
    line.purpose,
    line.receiptAttached ? 'Ja' : 'Nein',
    line.amount,
  ]);
  row.getCell(1).numFmt = DATE_FORMAT;
  row.getCell(7).numFmt = EUR_FORMAT;
}

function buildExpenseSheet(workbook: ExcelJS.Workbook, report: EuerYearReport): void {
  const sheet = workbook.addWorksheet('Ausgaben');
  makePrintable(sheet);
  setColumnWidths(sheet, [12, 24, 20, 20, 32, 8, 14]);

  boldRow(sheet.addRow([...EXPENSE_HEADERS]));
  for (const group of report.expenseGroups) {
    for (const line of group.lines) {
      addExpenseLine(sheet, line);
    }
    const subtotalRow = sheet.addRow([
      `Zwischensumme ${group.categoryLabel}`,
      '',
      '',
      '',
      '',
      '',
      group.subtotal,
    ]);
    boldRow(subtotalRow);
    subtotalRow.getCell(7).numFmt = EUR_FORMAT;
  }
  const totalRow = sheet.addRow(['Gesamtsumme Ausgaben', '', '', '', '', '', report.expenseTotal]);
  totalRow.font = { bold: true, size: 12 };
  totalRow.getCell(7).numFmt = EUR_FORMAT;

  if (report.nonTaxRelevantLines.length > 0) {
    addSectionTitle(sheet, 'Nicht steuerrelevant – nicht in der Summe');
    for (const line of report.nonTaxRelevantLines) {
      addExpenseLine(sheet, line);
    }
  }
}

function buildMonthSheet(workbook: ExcelJS.Workbook, report: EuerYearReport): void {
  const sheet = workbook.addWorksheet('Monatsübersicht');
  makePrintable(sheet);
  setColumnWidths(sheet, [16, 16, 16, 16]);

  boldRow(sheet.addRow(['Monat', 'Einnahmen', 'Ausgaben', 'Saldo']));
  for (const row of report.months) {
    const sheetRow = sheet.addRow([
      MONTH_NAMES[row.month - 1],
      row.income,
      row.expenses,
      row.balance,
    ]);
    [2, 3, 4].forEach((cell) => {
      sheetRow.getCell(cell).numFmt = EUR_FORMAT;
    });
  }
  const yearRow = sheet.addRow([
    `Jahr ${report.year}`,
    report.incomeTotal,
    report.expenseTotal,
    report.surplus,
  ]);
  boldRow(yearRow);
  [2, 3, 4].forEach((cell) => {
    yearRow.getCell(cell).numFmt = EUR_FORMAT;
  });
}

export async function buildEuerYearWorkbook(
  report: EuerYearReport,
  meta: EuerWorkbookMeta,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PolyGrid Studio';
  const createdAt = meta.createdAt ?? new Date();
  workbook.created = createdAt;

  buildOverviewSheet(workbook, report, meta, createdAt);
  buildIncomeSheet(workbook, report);
  buildExpenseSheet(workbook, report);
  buildMonthSheet(workbook, report);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}
