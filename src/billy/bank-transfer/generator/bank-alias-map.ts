import rawMap from './bank-name-map.json';

export interface BankEntry {
  bankName: string;
  bankCode: string;
}

export const BANK_MAP: Record<string, BankEntry> = {};

/** Normalize text */
function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Add alias with overwrite protection */
function addAlias(alias: string, entry: BankEntry, options?: { priority?: number }) {
  const key = normalize(alias);

  const existing = BANK_MAP[key];

  // If alias not used yet → save it
  if (!existing) {
    BANK_MAP[key] = entry;
    return;
  }

  // Priority handling: main banks should override other variants
  const existingIsMain = existing.bankName.endsWith('BANK');
  const newIsMain = entry.bankName.endsWith('BANK');

  if (!existingIsMain && newIsMain) {
    // New alias is main bank → override
    BANK_MAP[key] = entry;
    return;
  }

  // Otherwise, do not override to avoid Fidelity Mobile replacing Fidelity Bank
}

/** Build alias map */
for (const [name, code] of Object.entries(rawMap as Record<string, string>)) {
  const bankCode = String(code);
  const entry: BankEntry = { bankName: name, bankCode };

  const cleanName = normalize(name);
  const words = cleanName.split(' ');

  // 1. Add full name
  addAlias(cleanName, entry);

  // 2. Primary alias: first word (e.g., "fidelity", "fcmb")
  const primary = words[0];
  if (primary.length > 2) addAlias(primary, entry);

  // 3. Alias without bank/mfb/mobile/etc.
  if (cleanName.includes(' bank')) {
    addAlias(cleanName.replace(' bank', ''), entry);
  }

  if (cleanName.includes(' mfb')) {
    addAlias(cleanName.replace(' mfb', ''), entry);
  }

  if (cleanName.includes(' mobile')) {
    addAlias(cleanName.replace(' mobile', ''), entry);
  }
}

export const BANK_ALIASES = Object.keys(BANK_MAP);