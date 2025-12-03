import { Injectable } from '@nestjs/common';
import { CacheService } from '@/cache/cache.service';
import { WhatsappApiService } from '@/whatsapp/whatsapp-api.service';
import { BankResolverService } from '../bank-transfer/bank-resolver.service';
import { TransferService } from '../bank-transfer/transfer.service';
import { TransferSession } from '../bank-transfer/transfer-session.types';
import { UserService } from '@/flows/on-boading/services/user.service';


@Injectable()
export class FreeTextTransferStepsService {
  constructor(
    private readonly cache: CacheService,
    private readonly whatsappApi: WhatsappApiService,
    private readonly bankResolver: BankResolverService,
    private readonly transferService: TransferService,
    private readonly userService: UserService,
  ) {}

  // ---------------------------------------------------------
  private isCancel(text: string): boolean {
    return ['cancel', 'stop', 'end'].includes(text.toLowerCase());
  }

  private async abort(phone: string) {
    await this.cache.delete(`tx:${phone}`);
    return this.whatsappApi.sendText(phone, `❌ Transfer cancelled.`);
  }

  private async update(phone: string, session: TransferSession) {
    await this.cache.set(`tx:${phone}`, session);
  }

  // ---------------------------------------------------------
  // STEP 1 — Enter Amount
  // ---------------------------------------------------------
  async handleTransferAmount(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    // Support "10k", "2.5m", "5000"
    const cleaned = text.replace(/,/g, '').toLowerCase();
    const match = cleaned.match(/(\d+(\.\d+)?)(k|m)?/);

    if (!match) {
      return this.whatsappApi.sendText(phone, `❗ Invalid amount.\nType a valid amount or *cancel*.`);
    }

    let amount = parseFloat(match[1]);
    const suffix = match[3];

    if (suffix === 'k') amount *= 1000;
    if (suffix === 'm') amount *= 1_000_000;

    if (amount < 100) {
      return this.whatsappApi.sendText(phone, `❗ Minimum transfer amount is ₦100.`);
    }

    const session: TransferSession = {
      step: 'ENTER_ACCOUNT',
      data: { amount },
      createdAt: Date.now(),
    };

    await this.update(phone, session);

    return this.whatsappApi.sendText(
      phone,
      `🔢 Amount noted: *₦${amount.toLocaleString()}*.\n\nEnter the *recipient's account number*.\nType *cancel* to stop.`
    );
  }

  // ---------------------------------------------------------
  // STEP 2 — Enter Account Number
  // ---------------------------------------------------------
  async handleAccountNumber(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    if (!/^\d{10}$/.test(text)) {
      return this.whatsappApi.sendText(phone, `❗ Account number must be *10 digits*.\nType *cancel* to stop.`);
    }

    const session = await this.cache.get(`tx:${phone}`);
    session.data.accountNumber = text;
    session.step = 'ENTER_BANK';

    await this.update(phone, session);

    return this.whatsappApi.sendText(
      phone,
      `🏦 Good! Now enter the bank name.\nType *cancel* to stop.`
    );
  }

  // ---------------------------------------------------------
  // STEP 3 — Enter Bank Name → Resolve → Name Enquiry
  // ---------------------------------------------------------
  async handleBankName(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    const session: TransferSession = await this.cache.get(`tx:${phone}`);

    const bankResult = await this.bankResolver.resolveBank(
      text,
      session.data.accountNumber,
    );

    if (!bankResult.success) {
      // stay on same step
      return this.whatsappApi.sendText(
        phone,
        `❗ Could not identify bank. Try again.\nType *cancel* to stop.`
      );
    }

    const bank = bankResult.bank;

    session.data.bankCode = bank.bankCode;
    session.data.bankName = bank.bankName;
    session.data.accountName = bankResult.accountName;
    session.step = 'CONFIRM_PIN';

    await this.update(phone, session);

    return this.whatsappApi.sendText(
      phone,
      `🧾 *Confirm Transfer*\n\n` +
        `Amount: *₦${session.data.amount.toLocaleString()}*\n` +
        `Recipient: *${session.data.accountName}*\n` +
        `Bank: *${session.data.bankName}*\n` +
        `Account Number: *${session.data.accountNumber}*\n\n` +
        `Enter your 4-digit PIN.\n(Type *cancel* to stop)`
    );
  }

  // ---------------------------------------------------------
  // STEP 4 — PIN Handling & Transfer Execution
  // ---------------------------------------------------------
  async handlePinEntry(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    if (!/^\d{4}$/.test(text)) {
      return this.whatsappApi.sendText(phone, `❗ PIN must be 4 digits.\nType *cancel* to stop.`);
    }

    const session = await this.cache.get(`tx:${phone}`);

    // Verify PIN
    try {
      await this.transferService.verifyPin(phone, text);
    } catch (err) {
      return this.whatsappApi.sendText(phone, `❗ Incorrect PIN. Try again or type *cancel*.`);
    }

    // Execute transfer
    const result = await this.transferService.executeTransfer(phone, session.data);

    if (!result || result.responseCode !== '00') {
      await this.cache.delete(`tx:${phone}`);
      return this.whatsappApi.sendText(
        phone,
        `⚠️ Transfer failed: ${result?.responseMessage || 'Unknown error'}`
      );
    }

    // SUCCESS
    await this.whatsappApi.sendText(
      phone,
      `✅ *Transfer Successful!*\n\n₦${session.data.amount.toLocaleString()} sent to *${session.data.accountName}*.`
    );

    await this.whatsappApi.sendText(
      phone,
      `💾 Do you want to *save this beneficiary*?\nReply *yes* or *no*.`
    );

    await this.cache.set(`beneficiary:${phone}`, session.data);
    await this.cache.delete(`tx:${phone}`);

    return 'transfer_done';
  }

  // ---------------------------------------------------------
  // STEP 5 — Save Beneficiary
  // ---------------------------------------------------------
  async handleBeneficiaryDecision(phone: string, text: string) {
    if (this.isCancel(text)) return this.abort(phone);

    const pending = await this.cache.get(`beneficiary:${phone}`);
    if (!pending) return;

    if (text.toLowerCase() === 'yes') {
      await this.userService.saveBeneficiary(phone, pending);
      await this.whatsappApi.sendText(phone, `💾 Beneficiary saved successfully!`);
    } else {
      await this.whatsappApi.sendText(phone, `👍 No problem — beneficiary not saved.`);
    }

    await this.cache.delete(`beneficiary:${phone}`);
  }
}