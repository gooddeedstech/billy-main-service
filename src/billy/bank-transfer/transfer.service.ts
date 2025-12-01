import { Injectable, BadRequestException } from '@nestjs/common';
import { TransferParserService } from './transfer-parser.service';
import * as bcrypt from 'bcryptjs';
import { BankResolverService } from './bank-resolver.service';
import { UserService } from '@/flows/on-boading/services/user.service';
import { RubiesService } from '@/rubies/rubies.service';
import { CacheService } from '@/cache/cache.service';


@Injectable()
export class TransferService {
  constructor(
    private readonly parser: TransferParserService,
    private readonly bankResolver: BankResolverService,
    private readonly userService: UserService,
    private readonly rubies: RubiesService,
    private readonly cache: CacheService,
  ) {}

  /** ---------------------------------------------------------
   * 1️⃣ INITIAL TRANSFER PARSE & VERIFICATION
   *  Parse message → Get bank → Name enquiry → Ask for confirm
   * --------------------------------------------------------- */
  async startTransfer(from: string, rawMessage: string) {
    const user = await this.userService.findByPhone(from);

    if (!user) {
      return {
        next: 'onboarding_required',
      };
    }

    const parsed = this.parser.parse(rawMessage);

    if (!parsed.amount || !parsed.accountNumber) {
      return {
        ask: `❗ Please send in this format:\n\n*Transfer 5000 to 0023345566 GTBank*`,
      };
    }

    // ------------ Resolve bank name ------------
    const banks = await this.bankResolver.resolveBank(rawMessage, parsed.accountNumber);

    if (banks.length === 0) {
      return {
        ask: `❗ I couldn't identify the bank.\nPlease specify the bank name.`,
      };
    }

    if (banks.length > 1) {
      return {
        ask: `I found multiple possible banks.\nPlease specify: ${banks.map(b => b.bankName).join(', ')}`,
      };
    }

    const bank = banks[0];

    // --------- Name Enquiry (verify account number) ----------
    const enquiry = await this.rubies.nameEnquiry(bank.bankCode, parsed.accountNumber);

    if (enquiry?.data?.responseCode !== '00') {
      throw new BadRequestException(`Invalid account number.`);
    }

    const accountName = enquiry.data.accountName;

    // ---------------------------------------------------------
    // SAVE PENDING TX IN REDIS (awaiting PIN + final confirmation)
    // ---------------------------------------------------------
    const pendingPayload = {
      amount: parsed.amount,
      accountNumber: parsed.accountNumber,
      bankName: bank.bankName,
      bankCode: bank.bankCode,
      accountName,
    };

    await this.cache.set(`pending_tx:${from}`, pendingPayload, 60 * 3); // expires in 3 mins

    // ------- Ask user to confirm -------
    return {
      confirm: pendingPayload,
    };
  }

  /** ---------------------------------------------------------
   * 2️⃣ VERIFY PIN
   * --------------------------------------------------------- */
  async verifyPin(phone: string, pin: string) {
    const user = await this.userService.findByPhone(phone);
    if (!user) throw new BadRequestException('User not found');

    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) throw new BadRequestException('Incorrect PIN');

    return true;
  }

  /** ---------------------------------------------------------
   * 3️⃣ EXECUTE TRANSFER — after PIN confirmation
   * --------------------------------------------------------- */
  async executeTransfer(phone: string) {
    // 🔍 Load pending transfer from Redis
    const pending = await this.cache.get(`pending_tx:${phone}`);

    if (!pending) {
      throw new BadRequestException('No pending transfer found.');
    }

    const user = await this.userService.findByPhone(phone);
    if (!user) throw new BadRequestException('User not found');

    if (user.balance < pending.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // ------- Execute transfer via Rubies -------
    const tx = await this.rubies.fundTransfer({
      amount: pending.amount,
      creditAccountNumber: pending.accountNumber,
      creditAccountName: pending.accountName,
      bankCode: pending.bankCode,
      bankName: pending.bankName,
      narration: `Billy Transfer From: ${user.firstName} ${user.lastName}`,
      debitAccountNumber: user.virtualAccount,
      reference: `tx-${Date.now()}`,
      sessionId: `${user.phoneNumber}--${Date.now()}`,
    });

    // ------- Update wallet -------
    user.balance -= pending.amount;
  //  await this.userService.update(user.id, user);

    // ------- Clear pending transfer -------
    await this.cache.delete(`pending_tx:${phone}`);

    return tx;
  }

  /** ---------------------------------------------------------
   * 4️⃣ Allow user to save beneficiary after sending "yes"
   * --------------------------------------------------------- */
  async saveBeneficiary(from: string) {
    const pending = await this.cache.get(`pending_tx:${from}`);

    if (!pending) {
      throw new BadRequestException('No pending transfer to save as beneficiary.');
    }

    await this.userService.saveBeneficiary(from, pending);

    return true;
  }
}