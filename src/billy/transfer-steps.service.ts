import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { WhatsappApiService } from '@/whatsapp/whatsapp-api.service';
import { CacheService } from '@/cache/cache.service';
import { BankResolverService } from '@/billy/bank-transfer/bank-resolver.service';
import { RubiesService } from '@/rubies/rubies.service';
import { TransferService } from '@/billy/bank-transfer/transfer.service';
import { TransferSession, TransferSessionData } from './bank-transfer/transfer-session.types';

@Injectable()
export class TransferStepsService {
  private readonly logger = new Logger(TransferStepsService.name);

  constructor(
    private readonly whatsappApi: WhatsappApiService,
    private readonly cache: CacheService,
    private readonly bankResolver: BankResolverService,
    private readonly rubies: RubiesService,
    private readonly transferService: TransferService,
  ) {}

  private sessionKey(phone: string) {
    return `tx:${phone}`;
  }

  private async getSession(phone: string): Promise<TransferSession | null> {
    return (await this.cache.get(this.sessionKey(phone))) as TransferSession;
  }

  private async saveSession(
    phone: string,
    session: TransferSession,
    ttlSeconds = 15 * 60,
  ) {
    await this.cache.set(this.sessionKey(phone), session, ttlSeconds);
  }

  private async clearSession(phone: string) {
    await this.cache.delete(this.sessionKey(phone));
  }

  private delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // ---------------------------------------------------
  // 1️⃣ START FLOW WHEN MENU_TRANSFER IS SELECTED
  // ---------------------------------------------------
  async startTransferFlow(from: string, messageId: string) {
    const session: TransferSession = {
      step: 'ENTER_AMOUNT',
      data: {},
      createdAt: Date.now(),
    };

    await this.saveSession(from, session);

    await this.whatsappApi.sendTypingIndicator(from, messageId);
    await this.delay(600);

    await this.whatsappApi.sendText(
      from,
      `💸 *Transfer Money*\n\nHow much do you want to transfer?`,
    );

    return 'transfer_amount_requested';
  }

  // ---------------------------------------------------
  // 2️⃣ HANDLE AMOUNT
  // ---------------------------------------------------
  async handleTransferAmount(from: string, raw: string) {
    const session = await this.getSession(from);
    if (!session || session.step !== 'ENTER_AMOUNT') return;

    const amount = Number(raw.replace(/[^0-9]/g, ''));

    if (!amount || amount < 100) {
      return await this.whatsappApi.sendText(
        from,
        `❗ Please enter a valid amount (minimum ₦100).`,
      );
    }

    session.data.amount = amount;
    session.step = 'ENTER_ACCOUNT';
    await this.saveSession(from, session);

    await this.whatsappApi.sendText(
      from,
      `✅ You want to send *₦${amount.toLocaleString()}*.\n\n` +
        `Please enter the *recipient's 10-digit account number*.`,
    );
  }

  // ---------------------------------------------------
  // 3️⃣ HANDLE ACCOUNT NUMBER
  // ---------------------------------------------------
  async handleAccountNumber(from: string, raw: string) {
    const session = await this.getSession(from);
    if (!session || session.step !== 'ENTER_ACCOUNT') return;

    const accountNumber = raw.replace(/\s/g, '');

    if (!/^\d{10}$/.test(accountNumber)) {
      return await this.whatsappApi.sendText(
        from,
        `❗ Account number must be *10 digits*. Please re-enter.`,
      );
    }

    session.data.accountNumber = accountNumber;
    session.step = 'ENTER_BANK';
    await this.saveSession(from, session);

    await this.whatsappApi.sendText(
      from,
      `🏦 Got it.\n\nWhat *bank* does the recipient use? (e.g. *GTBank*, *Access*, *Zenith*)`,
    );
  }

  // ---------------------------------------------------
  // 4️⃣ HANDLE BANK NAME + NAME ENQUIRY
  // ---------------------------------------------------
  async handleBankName(from: string, raw: string) {
    const session = await this.getSession(from);
    if (!session || session.step !== 'ENTER_BANK') return;

    const { accountNumber, amount } = session.data;
    if (!accountNumber || !amount) {
      await this.clearSession(from);
      throw new BadRequestException('Transfer session expired. Please try again.');
    }

    const banks = await this.bankResolver.resolveBank(raw, accountNumber);

    if (!banks.length) {
      return await this.whatsappApi.sendText(
        from,
        `❗ I couldn't identify that bank. Please type the *exact bank name* (e.g. "GTBank").`,
      );
    }

    const bank = banks[0];

    const enquiry = await this.rubies.nameEnquiry(bank.bankCode, accountNumber);
    const data = enquiry?.data ?? enquiry;

    if (data?.responseCode !== '00') {
      return await this.whatsappApi.sendText(
        from,
        `❗ I couldn't verify this account. Please confirm the number and bank and try again.`,
      );
    }

    session.data.bankName = bank.bankName;
    session.data.bankCode = bank.bankCode;
    session.data.accountName = data.accountName;
    session.step = 'ENTER_PIN';
    await this.saveSession(from, session);

    await this.whatsappApi.sendText(
      from,
      `🧾 *Transfer Confirmation*\n\n` +
        `Amount: *₦${amount.toLocaleString()}*\n` +
        `Name: *${data.accountName}*\n` +
        `Bank: *${bank.bankName}*\n` +
        `Account: *${accountNumber}*\n\n` +
        `👉 Please enter your *4-digit transaction PIN* to confirm.`,
    );
  }

  // ---------------------------------------------------
  // 5️⃣ HANDLE PIN ENTRY → EXECUTE TRANSFER
  // ---------------------------------------------------
  async handlePinEntry(from: string, pin: string) {
    const session = await this.getSession(from);
    if (!session || session.step !== 'ENTER_PIN') return;

    if (!/^\d{4}$/.test(pin)) {
      return await this.whatsappApi.sendText(
        from,
        `❗ PIN must be *4 digits*. Please re-enter.`,
      );
    }

    const { amount, accountNumber, accountName, bankName, bankCode } =
      session.data;

    if (
      !amount ||
      !accountNumber ||
      !accountName ||
      !bankName ||
      !bankCode
    ) {
      await this.clearSession(from);
      throw new BadRequestException('Transfer session data incomplete.');
    }

    // 1) Verify PIN
    await this.transferService.verifyPin(from, pin);

    // 2) Execute transfer
    const payload = {
      amount,
      accountNumber,
      accountName,
      bankName,
      bankCode,
    };

    await this.whatsappApi.sendText(from, `⏳ Processing your transfer...`);

    const tx = await this.transferService.executeTransfer(from, payload);

    // 3) Clear session but keep beneficiary data in temp cache
    await this.clearSession(from);
    await this.cache.set(`tx:beneficiary:${from}`, payload, 10 * 60);

    await this.whatsappApi.sendText(
      from,
      `✅ *Transfer Successful!*\n\n` +
        `₦${amount.toLocaleString()} sent to *${accountName}* (${bankName}). 🎉`,
    );

    await this.whatsappApi.sendText(
      from,
      `💾 Would you like to *save this person* as a beneficiary?\nReply *yes* or *no*.`,
    );

    return tx;
  }

  // ---------------------------------------------------
  // 6️⃣ HANDLE BENEFICIARY YES/NO
  // ---------------------------------------------------
  async handleBeneficiaryDecision(from: string, text: string) {
    const lower = text.trim().toLowerCase();

    if (!['yes', 'no'].includes(lower)) return;

    const payload = (await this.cache.get(
      `tx:beneficiary:${from}`,
    )) as TransferSessionData;

    if (!payload) {
      return await this.whatsappApi.sendText(
        from,
        `Session expired. Next time after a transfer I'll ask again. 😉`,
      );
    }

    if (lower === 'no') {
      await this.cache.delete(`tx:beneficiary:${from}`);
      return await this.whatsappApi.sendText(
        from,
        `👍 No problem. Beneficiary not saved.`,
      );
    }

    // yes → save
    await this.transferService.saveBeneficiaryFromSession(from, {
      amount: payload.amount!,
      accountNumber: payload.accountNumber!,
      accountName: payload.accountName!,
      bankName: payload.bankName!,
      bankCode: payload.bankCode!,
    });

    await this.cache.delete(`tx:beneficiary:${from}`);

    return await this.whatsappApi.sendText(
      from,
      `💾 Beneficiary saved successfully! You can reuse them in future transfers.`,
    );
  }
}