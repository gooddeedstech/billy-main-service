import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BANK_MAP, BANK_ALIASES, BankEntry } from './bank-alias-map';
import { RubiesService } from '@/rubies/rubies.service';

@Injectable()
export class BankResolverServiceNew {
  private readonly logger = new Logger(BankResolverServiceNew.name);

  constructor(private readonly rubies: RubiesService) {}

  // Normalize user text
  private normalize(text: string): string {
    return text?.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  }

  private tokenize(text: string): string[] {
    return this.normalize(text).split(/\s+/).filter(Boolean);
  }

  private tokenSimilarity(a: string, b: string): number {
    const A = new Set(this.tokenize(a));
    const B = new Set(this.tokenize(b));

    const intersection = [...A].filter(x => B.has(x)).length;
    const union = new Set([...A, ...B]).size;

    return union === 0 ? 0 : intersection / union;
  }

  /** ---------------------------------------------------------
   * 1️⃣ DIRECT LOOKUP
   * --------------------------------------------------------- */
  private directLookup(text: string): BankEntry | null {
    const normalized = this.normalize(text);
    return BANK_MAP[normalized] ?? null;
  }

  /** ---------------------------------------------------------
   * 2️⃣ FUZZY MATCHING
   * --------------------------------------------------------- */
  private fuzzyLookup(text: string): BankEntry | null {
    let best: { entry: BankEntry; score: number } | null = null;

    for (const alias of BANK_ALIASES) {
      const score = this.tokenSimilarity(text, alias);

      if (score >= 0.55) {
        if (!best || score > best.score) {
          best = { entry: BANK_MAP[alias], score };
        }
      }
    }

    return best?.entry ?? null;
  }

  /** ---------------------------------------------------------
   * 3️⃣ NAME ENQUIRY (Rubies)
   * --------------------------------------------------------- */
  private async nameEnquiry(bankCode: string, accountNumber: string) {
    try {
      const response = await this.rubies.nameEnquiry(bankCode, accountNumber);
      return response;
    } catch {
      return null;
    }
  }

  /** ---------------------------------------------------------
   * 🔥 MAIN ENTRYPOINT
   * --------------------------------------------------------- */
  async resolveBank(
    text: string,
    accountNumber: string
  ): Promise<
    | { success: true; bank: BankEntry; accountName?: string }
    | { success: false; message: string }
  > {
    const normalized = this.normalize(text);

    this.logger.log(`🔎 Resolving bank from input: "${text}"`);

    // 1️⃣ Direct lookup
    let bank = this.directLookup(normalized);

    // 2️⃣ Fuzzy match if no direct match
    if (!bank) {
      bank = this.fuzzyLookup(text);
    }

    if (!bank) {
      return {
        success: false,
        message: `❗ Bank name not recognized. Please specify a valid bank.`,
      };
    }

    // 3️⃣ Verify using name enquiry
    const enquiry = await this.nameEnquiry(bank.bankCode, accountNumber);

    if (!enquiry || enquiry.responseCode !== '00') {
      return {
        success: false,
        message: '❗ Account verification failed. Ensure bank + account are correct.',
      };
    }

    return {
      success: true,
      bank,
      accountName: enquiry.accountName,
    };
  }
}