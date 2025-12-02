import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CacheService } from '@/cache/cache.service';
import { WhatsappApiService } from '@/whatsapp/whatsapp-api.service';
import { TransferService } from '@/billy/bank-transfer/transfer.service';
import { BankResolverService } from '@/billy/bank-transfer/bank-resolver.service';
import { TransferSession, TransferSessionData } from '@/billy/bank-transfer/transfer-session.types';

@Injectable()
export class TransferStepsService {
  private readonly logger = new Logger(TransferStepsService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly whatsappApi: WhatsappApiService,
    private readonly transferService: TransferService,
    private readonly bankResolver: BankResolverService,
  ) {}

  /* -------------------------------------------------------------------
     🛑 UNIVERSAL CANCEL HANDLER
  ------------------------------------------------------------------- */
  private async abort(phone: string, message?: string) {
    await this.cache.delete(`tx:${phone}`);
    await this.cache.delete(`beneficiary:${phone}`);

    return this.whatsappApi.sendText(
      phone,
      message || `❌ *Transfer cancelled.*`
    );
  }

  private isCancel(text: string): boolean {
    return text?.trim().toLowerCase() === 'cancel';
  }

  /* -------------------------------------------------------------------
     STEP 1 — ENTER AMOUNT
  ------------------------------------------------------------------- */
  async handleTransferAmount(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    const amount = Number(text.replace(/\D/g, ''));

    if (!amount || amount < 100) {
      return this.whatsappApi.sendText(
        phone,
        `❗ Enter a valid amount (minimum ₦100).\n\nType *cancel* to stop.`
      );
    }

    const session: TransferSession = {
      step: 'ENTER_ACCOUNT',
      data: { amount },
      createdAt: Date.now(),
    };

    await this.cache.set(`tx:${phone}`, session);

    return this.whatsappApi.sendText(
      phone,
      `🔢 Great! You're sending *₦${amount.toLocaleString()}*.\n\nEnter the *recipient's account number*.\n\nType *cancel* to stop.`
    );
  }

  /* -------------------------------------------------------------------
     STEP 2 — ENTER ACCOUNT NUMBER
  ------------------------------------------------------------------- */
  async handleAccountNumber(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    const accountNumber = text.trim();

    if (!/^\d{10}$/.test(accountNumber)) {
      return this.whatsappApi.sendText(
        phone,
        `❗ Account number must be 10 digits.\n\nType *cancel* to stop.`
      );
    }

    const session = await this.cache.get<TransferSession>(`tx:${phone}`);
    session.data.accountNumber = accountNumber;
    session.step = 'ENTER_BANK';

    await this.cache.set(`tx:${phone}`, session);

    return this.whatsappApi.sendText(
      phone,
      `🏦 Enter the *bank name* (e.g. GTBank, Access, Kuda).\n\nType *cancel* to stop.`
    );
  }

  /* -------------------------------------------------------------------
     STEP 3 — ENTER BANK NAME
  ------------------------------------------------------------------- */
  async handleBankName(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    const session = await this.cache.get<TransferSession>(`tx:${phone}`);

    const result = await this.bankResolver.resolveBank(
      text.trim(),
      session.data.accountNumber
    );

    if (!result.success) {
      return this.abort(phone, `❗ I couldn't recognize that bank.\nSession reset.`);
    }

    const bank = result.bank; // safe now

    session.data.bankCode = bank.bankCode;
    session.data.bankName = bank.bankName;
    session.data.accountName = result.accountName;
    session.step = 'ENTER_PIN';

    await this.cache.set(`tx:${phone}`, session);

    return this.whatsappApi.sendText(
      phone,
      `🧾 *Confirm Transfer*\n\n` +
        `• Amount: *₦${session.data.amount.toLocaleString()}*\n` +
        `• Recipient: *${result.accountName}*\n` +
        `• Bank: *${bank.bankName}*\n` +
        `• Account Number: *${session.data.accountNumber}*\n\n` +
        `Enter your *4-digit PIN* to continue.\nType *cancel* to abort.`
    );
  }




  async handleTransferConfirmation(phone: string, text: string) {
  if (!/^\d{4}$/.test(text)) {
    return this.whatsappApi.sendText(phone, `❗ PIN must be 4 digits.`);
  }

  const session = await this.cache.get(`tx:${phone}`);
  session.data.pin = text;
  session.step = 'ENTER_PIN';

  await this.cache.set(`tx:${phone}`, session);

  return this.handlePinEntry(phone, text);
}
  /* -------------------------------------------------------------------
     STEP 4 — PIN ENTRY + EXECUTE TRANSFER
  ------------------------------------------------------------------- */
  async handlePinEntry(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    if (!/^\d{4}$/.test(text)) {
      return this.whatsappApi.sendText(
        phone,
        `❗ PIN must be *4 digits*.\nTry again or type *cancel*.`
      );
    }
    const session = await this.cache.get(`tx:${phone}`);

    await this.transferService.verifyPin(phone, text);

    const tx = await this.transferService.executeTransfer(phone, session.data);

    await this.whatsappApi.sendText(
      phone,
      `✅ *Transfer Successful!*\n\n` +
        `₦${session.data.amount.toLocaleString()} sent to *${session.data.accountName}*.\n\n` +
        `💾 Do you want to *save this beneficiary*?\nReply *yes* or *no*.`
    );

    await this.cache.set(`beneficiary:${phone}`, session.data);
    await this.cache.delete(`tx:${phone}`);

    return 'transfer_complete';
  }

  /* -------------------------------------------------------------------
     STEP 5 — SAVE BENEFICIARY DECISION
  ------------------------------------------------------------------- */
  async handleBeneficiaryDecision(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    const pending = await this.cache.get(
      `beneficiary:${phone}`
    );

    if (!pending) {
      return this.whatsappApi.sendText(phone, `❗ No active transfer found.`);
    }

    const response = text.trim().toLowerCase();

    if (response === 'yes') {
      await this.transferService.saveBeneficiaryFromSession(phone, pending);

      await this.whatsappApi.sendText(
        phone,
        `💾 Beneficiary saved successfully!`
      );
    } else {
      await this.whatsappApi.sendText(
        phone,
        `👍 Okay! Beneficiary not saved.`
      );
    }

    await this.cache.delete(`beneficiary:${phone}`);

    return 'beneficiary_done';
  }
}