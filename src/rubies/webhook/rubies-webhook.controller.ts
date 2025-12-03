import {
  Controller,
  Post,
  Body,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from '@/flows/on-boading/services/user.service';
import { TransactionType } from '@/flows/on-boading/services/enum/user.enums';
import { UserTransactionService } from '@/billy/bank-transfer/user-transaction.service';
import { WhatsappApiService } from '@/whatsapp/whatsapp-api.service';

@Controller('webhook')
export class RubiesWebhookController {
  private readonly logger = new Logger(RubiesWebhookController.name);

  constructor(
    private readonly userService: UserService,
    private readonly txnService: UserTransactionService,
      private readonly whatsappApi: WhatsappApiService,
      
  ) {}

  /** =====================================================
   * 🔔 RUBIES WEBHOOK RECEIVER
   * ===================================================== */
  @Post('rubies')
  @HttpCode(200)
  async handleRubiesWebhook(@Body() payload: any) {
    this.logger.log('📩 Incoming Rubies webhook:', payload);

    try {
      // ---------------------------------------------------
      // 1️⃣ Required fields from Rubies
      // ---------------------------------------------------
      const amount = Number(payload.amount);
      const creditAccount = payload.creditAccount;
      const narration = payload.narration || 'Rubies Credit';
      const reference = payload.paymentReference || payload.sessionId;

      if (!creditAccount || !amount) {
        throw new BadRequestException('Invalid webhook payload');
      }

      // ---------------------------------------------------
      // 2️⃣ Look up user using virtual account number
      // ---------------------------------------------------
      const user = await this.userService.findByVirtualAccount(creditAccount);

      if (!user) {
        this.logger.error(`❗ No user found with VA: ${creditAccount}`);
        return { status: 'ignored_no_user' };
      }

      // ---------------------------------------------------
      // 3️⃣ Prevent duplicate credit (optional but recommended)
      // ---------------------------------------------------
      const exists = await this.txnService.findByReference(reference);
      if (exists) {
        this.logger.warn(`⚠️ Duplicate webhook ignored for ref ${reference}`);
        return { status: 'duplicate_ignored' };
      }

      // ---------------------------------------------------
      // 4️⃣ CREATE CREDIT TRANSACTION
      // ---------------------------------------------------
      await this.txnService.record(
        user.phoneNumber,
        TransactionType.CREDIT,
        amount,
        narration,
        reference);

      // ---------------------------------------------------
      // 5️⃣ UPDATE USER WALLET BALANCE
      // ---------------------------------------------------
      user.balance = Number(user.balance || 0) + amount;
      await this.userService.update(user.id, user);

      this.logger.log(
        `💰 Wallet credited: +₦${amount.toLocaleString()} → ${user.phoneNumber}`,
      );
      await this.whatsappApi.sendText(
  user.phoneNumber,
  `💰 *Wallet Credited Successfully!*\n\n` +
  `You just received *₦${amount.toLocaleString()}* from *${payload.originatorName}*.\n\n` +
  `🧾 *New Wallet Balance:* ₦${user.balance.toLocaleString()}\n\n` +
  `Thank you for using Billy. 🚀`
);
      return 'wallet credit'
    } catch (err) {
      this.logger.error('❌ Error processing Rubies webhook:', err);
      return { status: 'error', message: err.message };
    }
  }
}