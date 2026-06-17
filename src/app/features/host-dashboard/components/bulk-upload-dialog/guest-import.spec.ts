import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  normalizePhone,
  validateRows,
  revalidateRows,
  parseFile,
  buildTemplate,
  TEMPLATE_FILENAME,
  type ParsedGuestRow,
  type AnnotatedGuestRow,
  type ExistingGuestKey,
} from './guest-import';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Foo@Bar.COM  ')).toBe('foo@bar.com');
  });

  it('returns empty string for empty/nullish input', () => {
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail('   ')).toBe('');
    expect(normalizeEmail(null as unknown as string)).toBe('');
    expect(normalizeEmail(undefined as unknown as string)).toBe('');
  });
});

describe('normalizePhone', () => {
  it('strips all non-digit characters', () => {
    expect(normalizePhone('+94 77 234-5678')).toBe('94772345678');
    expect(normalizePhone('(077) 234 5678')).toBe('0772345678');
  });

  it('returns empty string for empty/nullish input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null as unknown as string)).toBe('');
    expect(normalizePhone(undefined as unknown as string)).toBe('');
  });
});

const row = (
  display_name: string,
  phone_number = '',
  email = '',
): ParsedGuestRow => ({ display_name, phone_number, email });

describe('validateRows', () => {
  it('valid row has no issues and rowId row-0', () => {
    const result = validateRows([row('Priya', '+94772345678', 'p@x.com')], []);
    expect(result).toHaveLength(1);
    expect(result[0].rowId).toBe('row-0');
    expect(result[0].issues).toEqual([]);
    expect(result[0].display_name).toBe('Priya');
  });

  it('flags name_required when name empty', () => {
    const result = validateRows([row('   ', '+94772345678', 'p@x.com')], []);
    expect(result[0].issues).toContain('name_required');
  });

  it('flags invalid_phone for a bad phone but not for an empty phone', () => {
    const bad = validateRows([row('Sam', 'abc', 'sam@x.com')], []);
    expect(bad[0].issues).toContain('invalid_phone');

    const empty = validateRows([row('Sam', '', 'sam@x.com')], []);
    expect(empty[0].issues).not.toContain('invalid_phone');
  });

  it('flags invalid_email for a bad email but not for an empty email', () => {
    const bad = validateRows([row('Sam', '+94772345678', 'not-an-email')], []);
    expect(bad[0].issues).toContain('invalid_email');

    const empty = validateRows([row('Sam', '+94772345678', '')], []);
    expect(empty[0].issues).not.toContain('invalid_email');
  });

  it('flags duplicate_in_file by email on the later row only', () => {
    const result = validateRows(
      [
        row('A', '+94770000001', 'same@x.com'),
        row('B', '+94770000002', 'SAME@x.com'),
      ],
      [],
    );
    expect(result[0].issues).not.toContain('duplicate_in_file');
    expect(result[1].issues).toContain('duplicate_in_file');
  });

  it('flags duplicate_in_file by phone on the later row only', () => {
    const result = validateRows(
      [
        row('A', '+94 77 234 5678', 'a@x.com'),
        row('B', '+94-77-234-5678', 'b@x.com'),
      ],
      [],
    );
    // both normalize to 94772345678
    expect(result[0].issues).not.toContain('duplicate_in_file');
    expect(result[1].issues).toContain('duplicate_in_file');
  });

  it('flags duplicate_existing against existing guests', () => {
    const existing: ExistingGuestKey[] = [
      { email: 'existing@x.com', phone: '94772345678' },
    ];
    const byEmail = validateRows([row('A', '', 'existing@x.com')], existing);
    expect(byEmail[0].issues).toContain('duplicate_existing');

    const byPhone = validateRows([row('B', '+94 77 234 5678', '')], existing);
    expect(byPhone[0].issues).toContain('duplicate_existing');
  });
});

describe('revalidateRows', () => {
  it('preserves rowId and clears a fixed issue', () => {
    const annotated = validateRows([row('   ', '+94772345678', 'p@x.com')], []);
    expect(annotated[0].issues).toContain('name_required');
    const originalRowId = annotated[0].rowId;

    const fixed: AnnotatedGuestRow[] = [{ ...annotated[0], display_name: 'Priya' }];
    const result = revalidateRows(fixed, []);
    expect(result[0].rowId).toBe(originalRowId);
    expect(result[0].issues).not.toContain('name_required');
  });

  it('recomputes duplicates after a row is removed', () => {
    const annotated = validateRows(
      [
        row('A', '+94770000001', 'same@x.com'),
        row('B', '+94770000002', 'same@x.com'),
      ],
      [],
    );
    expect(annotated[1].issues).toContain('duplicate_in_file');

    // remove the first row; the remaining row should no longer be a duplicate
    const remaining = [annotated[1]];
    const result = revalidateRows(remaining, []);
    expect(result[0].rowId).toBe(annotated[1].rowId);
    expect(result[0].issues).not.toContain('duplicate_in_file');
  });
});

describe('parseFile', () => {
  it('parses standard Name/Phone/Email headers', async () => {
    const file = new File(
      ['Name,Phone,Email\nPriya,+94 77 234 5678,p@x.com\n'],
      'guests.csv',
      { type: 'text/csv' },
    );
    const rows = await parseFile(file);
    expect(rows).toEqual([
      {
        display_name: 'Priya',
        phone_number: '+94 77 234 5678',
        email: 'p@x.com',
      },
    ]);
  });

  it('parses variant headers case-insensitively', async () => {
    const file = new File(
      ['Full Name,Phone Number,E-mail\nSam,(077) 234 5678,sam@x.com\n'],
      'guests.csv',
      { type: 'text/csv' },
    );
    const rows = await parseFile(file);
    expect(rows).toEqual([
      {
        display_name: 'Sam',
        phone_number: '(077) 234 5678',
        email: 'sam@x.com',
      },
    ]);
  });

  it('skips fully empty rows and trims values', async () => {
    const file = new File(
      [
        'Name,Phone,Email\n  Priya  , +94 77 234 5678 , p@x.com \n,,\nSam,,sam@x.com\n',
      ],
      'guests.csv',
      { type: 'text/csv' },
    );
    const rows = await parseFile(file);
    expect(rows).toEqual([
      {
        display_name: 'Priya',
        phone_number: '+94 77 234 5678',
        email: 'p@x.com',
      },
      { display_name: 'Sam', phone_number: '', email: 'sam@x.com' },
    ]);
  });

  it('throws when there is no Name column', async () => {
    const file = new File(
      ['Phone,Email\n+94772345678,p@x.com\n'],
      'guests.csv',
      { type: 'text/csv' },
    );
    await expect(parseFile(file)).rejects.toThrow();
  });
});

describe('buildTemplate', () => {
  it('csv first line equals the header', () => {
    const blob = buildTemplate('csv');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('csv content starts with Name,Phone,Email', async () => {
    const blob = buildTemplate('csv');
    const text = await blob.text();
    expect(text.split(/\r?\n/)[0]).toBe('Name,Phone,Email');
  });

  it('xlsx round-trips through parseFile to a row with a non-empty name', async () => {
    const blob = buildTemplate('xlsx');
    const buffer = await blob.arrayBuffer();
    const file = new File([buffer], 'template.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const rows = await parseFile(file);
    expect(rows).toHaveLength(2);
    expect(rows[0].display_name).toBe('Priya Sharma');
    expect(rows[1].display_name).toBe('Sam Perera');
  });

  it('exposes TEMPLATE_FILENAME values', () => {
    expect(TEMPLATE_FILENAME.csv).toBe('guest-list-template.csv');
    expect(TEMPLATE_FILENAME.xlsx).toBe('guest-list-template.xlsx');
  });
});
