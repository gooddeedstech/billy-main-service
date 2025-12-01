import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RubiesService } from '@/rubies/rubies.service';
import { BankSource, ResolvedBankDto } from '@/rubies/dto/resolved-bank.dto';
import { BANK_NAME_MAP } from './bank.constants';
import {  BankPattern, BANK_PATTERNS } from '@/rubies/dto/bank-patterns';


@Injectable()
export class BankResolverService {
  private readonly logger = new Logger(BankResolverService.name);

  /** Cached Rubies bank list (to avoid hitting API every time) */
  private bankListCache:
    | { banks: { code: string; name: string }[]; fetchedAt: number }
    | null = null;

  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(private readonly rubies: RubiesService) {}

  // -------------------------------------------------------------
  // 🧹 Normalization Helpers
  // -------------------------------------------------------------
  private normalize(text: string): string {
    return text.toLowerCase().trim();
  }

  private tokenize(text: string): string[] {
    return this.normalize(text)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  // Simple token overlap score: 0..1
  private tokenSimilarity(a: string, b: string): number {
    const aTokens = new Set(this.tokenize(a));
    const bTokens = new Set(this.tokenize(b));

    if (aTokens.size === 0 || bTokens.size === 0) return 0;

    let intersection = 0;
    for (const t of aTokens) {
      if (bTokens.has(t)) intersection++;
    }
    const union = new Set([...aTokens, ...bTokens]).size;
    return intersection / union;
  }

  // -------------------------------------------------------------
  // 1️⃣ TEXT-BASED DETECTION (BANK_NAME_MAP)
  // -------------------------------------------------------------
private detectBankFromText(message: string): {
  hits: ResolvedBankDto[];
  exactHit: ResolvedBankDto | null;
} {
  const normalized = this.normalize(message);

  const hits: ResolvedBankDto[] = [];
  let exactHit: ResolvedBankDto | null = null;

  for (const [alias, bankCode] of Object.entries(BANK_NAME_MAP) as [string, string][]) {
    const aliasNorm = this.normalize(alias);

    // ----------------------------------------------------
    // 🔥 EXACT TEXT MATCH (Highest Confidence)
    // ----------------------------------------------------
    if (normalized.includes(aliasNorm)) {
      const result: ResolvedBankDto = {
        bankCode,
        bankName: alias.toUpperCase(),
        normalizedName: aliasNorm,
        source: 'text' as BankSource,
        confidenceScore: 1.0,
      };

      hits.push(result);
      exactHit = result;
      continue;
    }

    // ----------------------------------------------------
    // 🔍 TOKEN SIMILARITY (Fuzzy Matching)
    // ----------------------------------------------------
    const sim = this.tokenSimilarity(message, alias);
    if (sim >= 0.5) {
      const result: ResolvedBankDto = {
        bankCode,
        bankName: alias.toUpperCase(),
        normalizedName: aliasNorm,
        source: 'text' as BankSource,
        confidenceScore: sim,
      };

      hits.push(result);

      // Near-perfect fuzzy match = treat as exactHit
      if (sim >= 0.9 && !exactHit) {
        exactHit = result;
      }
    }
  }

  return { hits, exactHit };
}

  // -------------------------------------------------------------
  // 2️⃣ PREFIX-BASED DETECTION (BANK_PATTERNS)
  // -------------------------------------------------------------
  private detectBankFromPrefix(accountNumber: string): ResolvedBankDto[] {
    const matches: ResolvedBankDto[] = [];

    for (const pattern of BANK_PATTERNS as BankPattern[]) {
      const lengthOk = pattern.lengths.includes(accountNumber.length);
      const prefixOk = pattern.prefixes.some((p) =>
        accountNumber.startsWith(p),
      );

      if (lengthOk && prefixOk) {
        matches.push({
          bankCode: pattern.bankCode,
          bankName: pattern.name,
          normalizedName: pattern.name.toLowerCase(),
          source: 'prefix',
          confidenceScore: 0.6, // moderate confidence
        });
      }
    }

    return matches;
  }

  // -------------------------------------------------------------
  // 3️⃣ RUBIES BANK LIST + NAME ENQUIRY (BRUTE FORCE)
  // -------------------------------------------------------------
  private async getCachedBankList(): Promise<
    { code: string; name: string }[]
  > {
    const now = Date.now();
    if (
      this.bankListCache &&
      now - this.bankListCache.fetchedAt < this.CACHE_TTL_MS
    ) {
      return this.bankListCache.banks;
    }

    const res = await this.rubies.getBanks();
    const list: { code: string; name: string }[] = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];

    this.bankListCache = { banks: list, fetchedAt: now };
    return list;
  }

  private async detectBankViaEnquiry(
    accountNumber: string,
  ): Promise<ResolvedBankDto[]> {
    const banks = await this.getCachedBankList();
    const matches: ResolvedBankDto[] = [];

    this.logger.log(
      `🔍 Starting Rubies name-enquiry brute force for ${accountNumber} over ${banks.length} banks`,
    );

    for (const bank of banks) {
  try {
    const data = await this.rubies.nameEnquiry(bank.code, accountNumber);

    if (data?.responseCode === "00") {
      matches.push({
        bankCode: bank.code,
        bankName: bank.name,
        normalizedName: bank.name.toLowerCase(),
        source: "enquiry",
        confidenceScore: 0.95,
        accountName: data.accountName,
      });
    }
  } catch (err) {
    this.logger.debug(
      `Name-enquiry failed for ${bank.code}/${bank.name} → skipping`,
    );
  }
}

    return matches;
  }

  // -------------------------------------------------------------
  // 🔺 MAIN ENTRYPOINT
  // -------------------------------------------------------------
  /**
   * Full resolution pipeline:
   *  1. Text-based detection (aliases, fuzzy)
   *  2. Account prefix-based detection (BIN-style)
   *  3. Rubies bank-list + name-enquiry brute force
   */
 async resolveBank(bank, accountNumber): Promise<any> {
  this.logger.log(`🏦 Resolving bank for ${bank}`);

  // -----------------------------------------------
  // 1️⃣ TEXT MATCH
  // -----------------------------------------------
  const { hits: textHits, exactHit } = this.detectBankFromText(bank);

  // 🔥 EXACT TEXT MATCH FOUND — trigger immediate name-enquiry
console.log(JSON.stringify(exactHit))
console.log(accountNumber)
  if (exactHit) {
    this.logger.log(`🎯 EXACT bank match detected → ${exactHit.bankName}`);

    const enquiry = await this.rubies.nameEnquiry(
      exactHit.bankCode,
      accountNumber,
    );

    console.log(enquiry)

    const data = enquiry;

    if (data?.responseCode !== '00') {
      throw new BadRequestException(
        `Name enquiry failed for ${exactHit.bankName}`,
      );
    }

    return {
      success: true,
      source: 'text-exact',
      message: 'Exact text match → name-enquiry resolved',
      bank: {
        bankCode: exactHit.bankCode,
        bankName: exactHit.bankName,
        accountName: data.accountName,
      },
      accountNumber
    };
  }

  // -----------------------------------------------
  // 2️⃣ NORMAL TEXT HITS
  // -----------------------------------------------
  const results: ResolvedBankDto[] = [...textHits];

  // -----------------------------------------------
  // 3️⃣ PREFIX MATCH
  // -----------------------------------------------
  const prefixHits = this.detectBankFromPrefix(accountNumber);
  prefixHits.forEach((hit) => {
    if (!results.some((r) => r.bankCode === hit.bankCode)) {
      results.push(hit);
    }
  });

  // If we have only one strong match (>=0.9), verify via name-enquiry
  if (results.length === 1 && results[0].confidenceScore >= 0.9) {
    this.logger.log(`🎯 Single strong match → verifying with name-enquiry`);

    const hit = results[0];

    const enquiry = await this.rubies.nameEnquiry(hit.bankCode, accountNumber);
    const data =  enquiry;

    if (data?.responseCode === '00') {
      hit.accountName = data.accountName;
      hit.source = 'verified';
      hit.confidenceScore = 1.0;

      return {
        success: true,
        message: 'Verified via name-enquiry',
        bank: hit
      };
    }
  }

  // -----------------------------------------------
  // 4️⃣ BRUTE-FORCE NAME ENQUIRY (fallback)
  // -----------------------------------------------
  const enquiryHits = await this.detectBankViaEnquiry(accountNumber);

  enquiryHits.forEach((hit) => {
    if (!results.some((r) => r.bankCode === hit.bankCode)) {
      results.push(hit);
    }
  });

  return {
    success: true,
    count: results.length,
    banks: results.sort((a, b) => b.confidenceScore - a.confidenceScore),

  };
}
}