import { Injectable } from '@nestjs/common';

@Injectable()
export class FreeTextTransferParserService {
  // ---------------------------------------------------------
  // 🔥 1. Normalize slang → convert all Nigerian slang to "transfer"
  // ---------------------------------------------------------
  private normalizeSlang(text: string): string {
    let t = text.toLowerCase();

    const slangMap: Record<string, string> = {
      "run am": "transfer",
      "run": "transfer",
      "wire": "transfer",
      "send am": "transfer",
      "credit": "transfer",
      "move": "transfer",
      "move am": "transfer",
      "drop": "transfer",
      "drop am": "transfer",
      "dash": "transfer",
      "gbese": "transfer",
      "run this": "transfer",
      "show love": "transfer",
      "settle": "transfer",
      "settle am": "transfer",
      "transfer am": "transfer",
      "pay": "transfer",
      "pay am": "transfer"
    };

    for (const [key, value] of Object.entries(slangMap)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      t = t.replace(regex, value);
    }

    return t;
  }

  // ---------------------------------------------------------
  // 🔥 2. General normalization (spaces, trimming)
  // ---------------------------------------------------------
  private normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // ---------------------------------------------------------
  // 🔥 3. Extract amount (supports "5k", "2.5m", "20,000", "50 g")
  // ---------------------------------------------------------
  private extractAmount(text: string): number | undefined {
    const cleaned = text.replace(/,/g, '').toLowerCase();

    const regex = /(\d+(\.\d+)?)(k|m)?/g;

    let match;
    let best = 0;

    while ((match = regex.exec(cleaned)) !== null) {
      let num = parseFloat(match[1]);
      const unit = match[3];

      if (unit === 'k') num *= 1000;
      if (unit === 'm') num *= 1_000_000;

      // ignore "account numbers" mistakenly matching as amount
      if (num < 9999999999) best = Math.max(best, num);
    }

    return best || undefined;
  }

  // ---------------------------------------------------------
  // 🔥 4. Extract NUBAN 10-digit account number
  // ---------------------------------------------------------
  private extractAccountNumber(text: string): string | undefined {
    const match = text.match(/\b\d{10}\b/);
    return match?.[0];
  }

  // ---------------------------------------------------------
  // 🔥 5. Extract bank text
  // ---------------------------------------------------------
  private extractBankText(text: string): string | undefined {
    const t = this.normalize(text);

    // Pattern: transfer 5k to 0033445566 opay
    const toPattern = t.match(/to\s+\d{10}\s+([a-z\s]+)/);
    if (toPattern?.[1]) return toPattern[1].trim();

    // Pattern: 0033445566 gtb
    const afterAcct = t.match(/\d{10}\s+([a-z\s]+)/);
    if (afterAcct?.[1]) return afterAcct[1].trim();

    // Last word heuristic: transfer 5k gtb
    const last = t.split(' ').pop();
    if (last && isNaN(Number(last)) && last.length >= 3) {
      return last.trim();
    }

    return undefined;
  }

  // ---------------------------------------------------------
  // 🔥 6. Intent detection: “Is user trying to transfer?”
  // ---------------------------------------------------------
  private isTransferIntent(text: string): boolean {
    const keywords = [
      "transfer",
      "send",
      "credit",
      "wire",
      "run",
      "run am",
      "move",
      "drop",
      "dash",
      "settle",
      "gbese",
      "send money",
      "send am",
    ];

    return keywords.some((k) => text.includes(k));
  }

  // ---------------------------------------------------------
  // 🔥 MAIN PARSER
  // ---------------------------------------------------------
  parse(text: string): {
    isTransferIntent: boolean;
    amount?: number;
    accountNumber?: string;
    bankText?: string;
  } {
    // Normalize slang first
    let normalized = this.normalizeSlang(text);
    normalized = this.normalize(normalized);

    return {
      isTransferIntent: this.isTransferIntent(normalized),
      amount: this.extractAmount(normalized),
      accountNumber: this.extractAccountNumber(normalized),
      bankText: this.extractBankText(normalized),
    };
  }
}