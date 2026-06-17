import * as XLSX from 'xlsx';
import { PHONE_REGEX, EMAIL_REGEX } from '../../../../shared/validation/guest-validation';

// --- Normalize helpers ---
export function normalizeEmail(value: string): string {
  return (value ?? '').trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

// --- Types ---
export interface ParsedGuestRow {
  display_name: string;
  phone_number: string;
  email: string;
}

export type RowIssue =
  | 'name_required'
  | 'invalid_phone'
  | 'invalid_email'
  | 'duplicate_in_file'
  | 'duplicate_existing';

export interface AnnotatedGuestRow extends ParsedGuestRow {
  rowId: string;
  issues: RowIssue[];
}

export interface ExistingGuestKey {
  email: string; // pre-normalized
  phone: string; // pre-normalized
}

// --- Validation ---
export function validateRows(
  rows: ParsedGuestRow[],
  existingGuests: ExistingGuestKey[],
): AnnotatedGuestRow[] {
  const existingEmails = new Set(
    existingGuests.map((g) => g.email).filter((v) => v !== ''),
  );
  const existingPhones = new Set(
    existingGuests.map((g) => g.phone).filter((v) => v !== ''),
  );

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  return rows.map((rawRow, i) => {
    const display_name = (rawRow.display_name ?? '').trim();
    const phone_number = (rawRow.phone_number ?? '').trim();
    const email = (rawRow.email ?? '').trim();

    // Validate the raw user-entered format; normalization (digits-only /
    // lowercase) is used only for duplicate detection below.
    const normEmail = normalizeEmail(email);
    const normPhone = normalizePhone(phone_number);

    const issues: RowIssue[] = [];

    if (display_name === '') {
      issues.push('name_required');
    }
    if (phone_number !== '' && !PHONE_REGEX.test(phone_number)) {
      issues.push('invalid_phone');
    }
    if (email !== '' && !EMAIL_REGEX.test(email)) {
      issues.push('invalid_email');
    }

    const dupInFile =
      (normEmail !== '' && seenEmails.has(normEmail)) ||
      (normPhone !== '' && seenPhones.has(normPhone));
    if (dupInFile) {
      issues.push('duplicate_in_file');
    }

    const dupExisting =
      (normEmail !== '' && existingEmails.has(normEmail)) ||
      (normPhone !== '' && existingPhones.has(normPhone));
    if (dupExisting) {
      issues.push('duplicate_existing');
    }

    if (normEmail !== '') {
      seenEmails.add(normEmail);
    }
    if (normPhone !== '') {
      seenPhones.add(normPhone);
    }

    return { display_name, phone_number, email, rowId: `row-${i}`, issues };
  });
}

export function revalidateRows(
  rows: AnnotatedGuestRow[],
  existingGuests: ExistingGuestKey[],
): AnnotatedGuestRow[] {
  const stripped: ParsedGuestRow[] = rows.map((r) => ({
    display_name: r.display_name,
    phone_number: r.phone_number,
    email: r.email,
  }));
  const fresh = validateRows(stripped, existingGuests);
  return fresh.map((r, i) => ({ ...r, rowId: rows[i].rowId }));
}

// --- Header alias resolution ---
const COLUMN_ALIASES = {
  display_name: ['name', 'full name', 'display name', 'guest name'],
  phone_number: ['phone', 'phone number', 'mobile', 'contact', 'contact number'],
  email: ['email', 'e-mail', 'email address'],
} as const;

function resolveColumnIndex(
  header: unknown[],
  aliases: readonly string[],
): number {
  return header.findIndex((cell) => {
    const value = String(cell ?? '')
      .trim()
      .toLowerCase();
    return value !== '' && aliases.includes(value);
  });
}

// --- File parsing ---
export async function parseFile(file: File): Promise<ParsedGuestRow[]> {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) {
    throw new Error('The file has no readable sheet.');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
  });
  if (rows.length === 0) {
    throw new Error('The file is empty.');
  }

  const header = rows[0];
  const nameIdx = resolveColumnIndex(header, COLUMN_ALIASES.display_name);
  const phoneIdx = resolveColumnIndex(header, COLUMN_ALIASES.phone_number);
  const emailIdx = resolveColumnIndex(header, COLUMN_ALIASES.email);

  if (nameIdx === -1) {
    throw new Error(
      'Could not find a "Name" column. Please use the provided template.',
    );
  }

  const cell = (row: unknown[], idx: number): string =>
    idx === -1 ? '' : String(row[idx] ?? '').trim();

  return rows
    .slice(1)
    .map((row) => ({
      display_name: cell(row, nameIdx),
      phone_number: cell(row, phoneIdx),
      email: cell(row, emailIdx),
    }))
    .filter(
      (r) =>
        r.display_name !== '' || r.phone_number !== '' || r.email !== '',
    );
}

// --- Template generation ---
export const TEMPLATE_FILENAME = {
  csv: 'guest-list-template.csv',
  xlsx: 'guest-list-template.xlsx',
} as const;

// Header row + example rows shown in the downloadable template.
const TEMPLATE_ROWS = [
  ['Name', 'Phone', 'Email'],
  ['Priya Sharma', '+94 77 234 5678', 'priya@example.com'],
  ['Sam Perera', '', 'sam@example.com'],
];

export function buildTemplate(format: 'csv' | 'xlsx'): Blob {
  const sheet = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);

  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Guests');
  const out = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
