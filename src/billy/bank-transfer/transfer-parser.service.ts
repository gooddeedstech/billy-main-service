import { Injectable } from '@nestjs/common';
import { BANK_NAME_MAP } from './bank.constants';


@Injectable()
export class TransferParserService {

  parse(message: string) {
    const text = message.toLowerCase();

    // -------- Amount (supports: 5k, 10,000, ₦5,000, 20000) -------
    const amountMatch =
      text.match(/(\d+(\,\d+)?)/)?.[0] || 
      text.match(/(\d+)(k)/)?.[1];

    let amount = 0;
    if (amountMatch) {
      amount = Number(amountMatch.replace(/,/g, ''));
      if (text.includes('k')) amount = amount * 1000;
    }

    // ----------------- Account number -------------------------
    const accMatch = text.match(/\b\d{10}\b/);
    const accountNumber = accMatch ? accMatch[0] : null;

    // ---------------- Bank name (via alias map) ---------------
    let bankName = null;
    let bankCode = null;

    for (const alias of Object.keys(BANK_NAME_MAP)) {
      if (text.includes(alias)) {
        bankName = alias;
        bankCode = BANK_NAME_MAP[alias];
        break;
      }
    }

    return {
      amount,
      accountNumber,
      bankName,
      bankCode,
    };
  }
}