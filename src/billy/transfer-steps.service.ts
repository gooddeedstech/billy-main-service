import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CacheService } from '@/cache/cache.service';
import { WhatsappApiService } from '@/whatsapp/whatsapp-api.service';
import { UserService } from '@/flows/on-boading/services/user.service';
import { TransferService } from '@/billy/bank-transfer/transfer.service';
import { BankResolverService } from './bank-transfer/bank-resolver.service';


@Injectable()
export class TransferStepsService {
  private readonly logger = new Logger(TransferStepsService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly whatsappApi: WhatsappApiService,
    private readonly userService: UserService,
    private readonly transferService: TransferService,
    private readonly bankResolver: BankResolverService,
  ) {}

  /*---------------------------------------------------------
   🔥 STEP 1 — Enter Amount
  ---------------------------------------------------------*/
  async handleTransferAmount(phone: string, text: string) {
    const amount = this.parseAmount(text);

    if (!amount) {
      return this.whatsappApi.sendText(
        phone,
        `❗ Invalid amount.\nPlease enter something like:\n• 5000\n• 75k\n• 2m`
      );
    }

    const session = await this.cache.get(`tx:${phone}`);
    session.data.amount = amount;
    session.step = 'ENTER_ACCOUNT';

    await this.cache.set(`tx:${phone}`, session);

    return this.whatsappApi.sendText(
      phone,
      `🔢 Great! Enter the *recipient's account number*.`
    );
  }

  private parseAmount(text: string): number | null {
    const value = text.toLowerCase().trim();

    if (/^\d+$/.test(value)) return parseInt(value);

    if (/^\d+k$/.test(value)) return parseInt(value) * 1000;

    if (/^\d+m$/.test(value)) return parseInt(value) * 1_000_000;

    return null;
  }

  /*---------------------------------------------------------
   🔥 STEP 2 — Enter Account Number
  ---------------------------------------------------------*/
  async handleAccountNumber(phone: string, text: string) {
    if (!/^\d{6,15}$/.test(text)) {
      return this.whatsappApi.sendText(phone, `❗ Invalid account number.`);
    }

    const session = await this.cache.get(`tx:${phone}`);
    session.data.accountNumber = text;
    session.step = 'ENTER_BANK';

    await this.cache.set(`tx:${phone}`, session);

    return this.whatsappApi.sendText(
      phone,
      `🏦 Enter the *bank name* (e.g. GTBank, Zenith, Access).`
    );
  }

  /*---------------------------------------------------------
   🔥 STEP 3 — Enter Bank Name
  ---------------------------------------------------------*/
  async handleBankName(phone: string, text: string) {
    const session = await this.cache.get(`tx:${phone}`);

    const possibleBanks = await this.bankResolver.resolveBank(
      text,
      session.data.accountNumber
    );
  this.logger.log(`🎯 possible banks → ${possibleBanks}`);
 

    if (!possibleBanks.length) {
      await this.cache.delete(`tx:${phone}`);
      return this.whatsappApi.sendText(phone, `❗ I could not recognize that bank.\nTry again.`);
    }

    if (possibleBanks.length > 1) {
      return this.whatsappApi.sendText(
        phone,
        `❗ Multiple matches found.\nWhich one do you mean?\n${possibleBanks
          .map((b) => `• ${b.bankName}`)
          .join('\n')}`
      );
    }

    const bank = possibleBanks.bank;
    console.log(`MEYI ${JSON.stringify(bank)}`)

    // 👉 Name Enquiry
    const enquiry = await this.bankResolver.resolveBank(
      bank.bankCode,
      session.data.accountNumber
    );

    if (enquiry?.data?.responseCode !== '00') {
      throw new BadRequestException('Invalid account number.');
    }

    session.data.bankCode = bank.bankCode;
    session.data.bankName = bank.bankName;
    session.data.accountName = enquiry.data.accountName;
    session.step = 'CONFIRM';

    await this.cache.set(`tx:${phone}`, session);

    return this.whatsappApi.sendText(
      phone,
      `🧾 *Confirm Transfer*\n\n` +
        `Amount: *₦${session.data.amount.toLocaleString()}*\n` +
        `Recipient: *${enquiry.data.accountName}*\n` +
        `Bank: *${bank.bankName}*\n` +
        `Account Number: *${session.data.accountNumber}*\n\n` +
        `Enter your *4-digit PIN* to proceed.`
    );
  }

  /*---------------------------------------------------------
   🔥 STEP 4 — Confirm Transfer (ENTER PIN)
  ---------------------------------------------------------*/
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

  /*---------------------------------------------------------
   🔥 STEP 5 — Validate PIN + Execute Transfer
  ---------------------------------------------------------*/
  async handlePinEntry(phone: string, pin: string) {
    const session = await this.cache.get(`tx:${phone}`);

    await this.transferService.verifyPin(phone, pin);

    const tx = await this.transferService.executeTransfer(phone, session.data);

    await this.whatsappApi.sendText(
      phone,
      `✅ *Transfer Successful!*\n\n` +
        `₦${session.data.amount.toLocaleString()} sent to *${session.data.accountName}*.\n\n` +
        `💾 Save this as a beneficiary?\nReply *yes* or *no*.`
    );

    await this.cache.set(`beneficiary:${phone}`, session.data);
    await this.cache.delete(`tx:${phone}`);

    return 'transfer_done';
  }

  /*---------------------------------------------------------
   🔥 STEP 6 — Save Beneficiary Decision
  ---------------------------------------------------------*/
  async handleBeneficiaryDecision(phone: string, text: string) {
    const pending = await this.cache.get(`beneficiary:${phone}`);

    if (!pending) return;

    if (text.toLowerCase() === 'yes') {
      await this.userService.saveBeneficiary(phone, pending);

      await this.whatsappApi.sendText(
        phone,
        `💾 Beneficiary saved successfully!`
      );
    } else {
      await this.whatsappApi.sendText(
        phone,
        `👍 Okay! I won’t save this beneficiary.`
      );
    }

    await this.cache.delete(`beneficiary:${phone}`);

    return 'beneficiary_done';
  }
}