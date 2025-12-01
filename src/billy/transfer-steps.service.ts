import { Injectable, BadRequestException } from '@nestjs/common';
import { CacheService } from '@/cache/cache.service';
import { WhatsappApiService } from '@/whatsapp/whatsapp-api.service';
import { BankResolverService } from '@/billy/bank-transfer/bank-resolver.service';
import { TransferService, ExecuteTransferPayload } from '@/billy/bank-transfer/transfer.service';
import { UserService } from '@/flows/on-boading/services/user.service';
import { TransferSession } from './bank-transfer/transfer-session.types';


@Injectable()
export class TransferStepsService {
  private readonly SESSION_TTL = 5 * 60; // 5 minutes

  constructor(
    private readonly cache: CacheService,
    private readonly whatsappApi: WhatsappApiService,
    private readonly bankResolver: BankResolverService,
    private readonly transferService: TransferService,
    private readonly userService: UserService,
  ) {}

  private sessionKey(phone: string) {
    return `tx:${phone}`;
  }

  private beneficiaryKey(phone: string) {
    return `beneficiary:${phone}`;
  }

  private async saveSession(phone: string, session: TransferSession) {
    await this.cache.set(this.sessionKey(phone), session, this.SESSION_TTL);
  }

  private async loadSession(phone: string): Promise<TransferSession | null> {
    return this.cache.get<TransferSession>(this.sessionKey(phone));
  }

  private async clearSession(phone: string) {
    await this.cache.delete(this.sessionKey(phone));
  }

  private async delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // -------------------------------------------------
  // 🟢 STEP 0 – Started from menu: "Transfer Money"
  // -------------------------------------------------
  async startTransferFlow(from: string, messageId: string) {
    // ensure user exists
    const user = await this.userService.findByPhone(from);
    if (!user) {
      await this.whatsappApi.sendText(
        from,
        `👋 Welcome! Please complete onboarding first so we can enable transfers.`,
      );
      return;
    }

    const session: TransferSession = {
      step: 'ENTER_AMOUNT',
      data: {},
    };

    await this.saveSession(from, session);

    await this.whatsappApi.sendText(
      from,
      `💸 *Transfer Money*\nHow much do you want to transfer? (e.g. 5000 or 50k)`,
    );
  }

  // -------------------------------------------------
  // STEP 1 – Enter amount
  // -------------------------------------------------
  private parseAmount(text: string): number | null {
    const cleaned = text.replace(/,/g, '').toLowerCase().trim();

    // 50k / 10k
    const kMatch = cleaned.match(/^(\d+(\.\d+)?)k$/);
    if (kMatch) {
      const base = parseFloat(kMatch[1]);
      if (isNaN(base)) return null;
      return Math.round(base * 1000);
    }

    const num = Number(cleaned);
    if (isNaN(num) || num <= 0) return null;

    return Math.round(num);
  }

  async handleTransferAmount(from: string, text: string) {
    const session = await this.loadSession(from);
    if (!session || session.step !== 'ENTER_AMOUNT') return;

    const amount = this.parseAmount(text);
    if (!amount || amount <= 0) {
      await this.whatsappApi.sendText(
        from,
        `❗ I couldn't understand that amount.\nPlease enter a number like *5000* or *50k*.`,
      );
      return;
    }

    session.step = 'ENTER_ACCOUNT';
    session.data.amount = amount;
    session.data.rawAmount = text;

    await this.saveSession(from, session);

    await this.whatsappApi.sendText(
      from,
      `🔢 Great! *₦${amount.toLocaleString()}*.\nNow enter the *10-digit account number* you want to send to.`,
    );
  }

  // -------------------------------------------------
  // STEP 2 – Enter account number
  // -------------------------------------------------
  async handleAccountNumber(from: string, text: string) {
    const session = await this.loadSession(from);
    if (!session || session.step !== 'ENTER_ACCOUNT') return;

    const digits = text.replace(/\D/g, '');
    if (digits.length !== 10) {
      await this.whatsappApi.sendText(
        from,
        `❗ Account number must be *10 digits*.\nPlease re-enter the account number.`,
      );
      return;
    }

    session.step = 'ENTER_BANK';
    session.data.accountNumber = digits;

    await this.saveSession(from, session);

    await this.whatsappApi.sendText(
      from,
      `🏦 Got it.\nNow type the *bank name* (e.g. *GTBank*, *Access*, *Kuda*).`,
    );
  }

  // -------------------------------------------------
  // STEP 3 – Enter bank name → resolve + name enquiry
  // -------------------------------------------------
  async handleBankName(from: string, text: string) {
    const session = await this.loadSession(from);
    if (!session || session.step !== 'ENTER_BANK') return;

    const { accountNumber, amount } = session.data;
    if (!accountNumber || !amount) {
      await this.clearSession(from);
      await this.whatsappApi.sendText(
        from,
        `⚠️ Session expired. Please start the transfer again.`,
      );
      return;
    }

    // Use your bank resolver engine
    const hits = await this.bankResolver.resolveBank(text, accountNumber);

    if (!hits || hits.length === 0) {
      await this.whatsappApi.sendText(
        from,
        `❗ I couldn't recognize that bank.\nPlease type the correct bank name (e.g. *GTBank*, *Wema*, *Kuda*).`,
      );
      return;
    }

    const bank = hits[0]; // best candidate

    // Name enquiry
    const enquiry = await this.rubiesNameEnquirySafe(
      bank.bankCode,
      accountNumber,
    );

    if (!enquiry.ok) {
      await this.whatsappApi.sendText(
        from,
        `⚠️ I couldn't validate that account. Please double-check the bank and account number.`,
      );
      return;
    }

    const accountName = enquiry.accountName;

    session.step = 'CONFIRM';
    session.data.bankCode = bank.bankCode;
    session.data.bankName = bank.bankName;
    session.data.accountName = accountName;

    await this.saveSession(from, session);

    await this.whatsappApi.sendText(
      from,
      `🧾 *Transfer Confirmation*\n\n` +
        `You are about to send *₦${amount.toLocaleString()}* to:\n\n` +
        `👤 *${accountName}*\n` +
        `🏦 *${bank.bankName}*\n` +
        `🔢 *${accountNumber}*\n\n` +
        `Reply *yes* to continue or *no* to cancel.`,
    );
  }

  // helper
  private async rubiesNameEnquirySafe(bankCode: string, account: string) {
    try {
      const res = await this.bankResolver['rubies'].nameEnquiry(
        bankCode,
        account,
      ); // or inject RubiesService separately if you prefer
      const data = res?.data ?? res;

      if (data?.responseCode === '00') {
        return { ok: true, accountName: data.accountName as string };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }

  // -------------------------------------------------
  // STEP 4 – Confirm / cancel
  // -------------------------------------------------
  async handleTransferConfirmation(from: string, text: string) {
    const session = await this.loadSession(from);
    if (!session || session.step !== 'CONFIRM') return;

    const answer = text.trim().toLowerCase();

    if (answer === 'no' || answer === 'cancel') {
      await this.clearSession(from);
      await this.whatsappApi.sendText(
        from,
        `❌ Transfer cancelled. No money was moved.`,
      );
      return;
    }

    if (answer !== 'yes') {
      await this.whatsappApi.sendText(
        from,
        `Please reply *yes* to proceed or *no* to cancel.`,
      );
      return;
    }

    // Move to PIN step
    session.step = 'ENTER_PIN';
    await this.saveSession(from, session);

    await this.whatsappApi.sendText(
      from,
      `🔐 Please enter your *4-digit transaction PIN* to confirm.`,
    );
  }

  // -------------------------------------------------
  // STEP 5 – Enter PIN → execute transfer
  // -------------------------------------------------
  async handlePinEntry(from: string, text: string) {
    const session = await this.loadSession(from);
    if (!session || session.step !== 'ENTER_PIN') return;

    if (!/^\d{4}$/.test(text.trim())) {
      await this.whatsappApi.sendText(
        from,
        `❗ PIN must be *4 digits*.\nPlease re-enter your PIN.`,
      );
      return;
    }

    const { amount, accountNumber, bankCode, bankName, accountName } =
      session.data;

    if (!amount || !accountNumber || !bankCode || !bankName || !accountName) {
      await this.clearSession(from);
      await this.whatsappApi.sendText(
        from,
        `⚠️ Session data incomplete. Please restart the transfer.`,
      );
      return;
    }

    // 1) Verify PIN
    await this.transferService.verifyPin(from, text.trim());

    // 2) Execute transfer
    const payload: ExecuteTransferPayload = {
      amount,
      accountNumber,
      bankCode,
      bankName,
      accountName,
    };

    const tx = await this.transferService.executeTransfer(from, payload);

    // Clear transfer session
    await this.clearSession(from);

    // Save beneficiary payload to cache for yes/no
    await this.cache.set(
      this.beneficiaryKey(from),
      {
        accountNumber,
        bankName,
        bankCode,
        accountName,
      },
      600,
    );

    // Notify success
    await this.whatsappApi.sendText(
      from,
      `✅ *Transfer Successful!*\n\n` +
        `₦${amount.toLocaleString()} sent to *${accountName}* (${bankName}).`,
    );

    await this.whatsappApi.sendText(
      from,
      `💾 Do you want to *save this recipient* as a beneficiary?\nReply *yes* or *no*.`,
    );

    return tx;
  }

  // -------------------------------------------------
  // Beneficiary YES/NO handler
  // -------------------------------------------------
  async handleBeneficiaryDecision(from: string, text: string) {
    const lower = text.trim().toLowerCase();
    if (lower !== 'yes' && lower !== 'no') return;

    const pending = await this.cache.get<any>(this.beneficiaryKey(from));
    if (!pending) return; // nothing to do

    if (lower === 'no') {
      await this.cache.delete(this.beneficiaryKey(from));
      await this.whatsappApi.sendText(
        from,
        `👍 No problem, beneficiary not saved.`,
      );
      return;
    }

    // yes → save beneficiary
    await this.userService.saveBeneficiary(from, {
      number: pending.accountNumber,
      bankCode: pending.bankCode,
      bankName: pending.bankName,
      accountName: pending.accountName,
    });

    await this.cache.delete(this.beneficiaryKey(from));

    await this.whatsappApi.sendText(
      from,
      `💾 Beneficiary saved successfully!`,
    );
  }
}