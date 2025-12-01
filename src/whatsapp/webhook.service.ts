import { Injectable, Logger } from '@nestjs/common';
import { WhatsappApiService } from './whatsapp-api.service';
import { UserService } from '@/flows/on-boading/services/user.service';
import { TransferService } from '@/billy/bank-transfer/transfer.service';
import { CacheService } from '@/cache/cache.service';
import { VasService } from '@/billy/vas.service';

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly whatsappApi: WhatsappApiService,
    private readonly userService: UserService,
    private readonly transferService: TransferService,
    private readonly cache: CacheService,
    private readonly vasService: VasService,
  ) {}

  /** ======================================================
   * 📥 MAIN MESSAGE HANDLER
   * ====================================================== */
  async handleIncomingWebhook(body: any) {
    this.logger.debug('📥 Incoming WhatsApp Webhook');

    const entry = body?.entry?.[0]?.changes?.[0]?.value;
    if (!entry) return 'ignored';

    const msg = entry.messages?.[0];
    const flowResponse = entry.interactive?.flow_response;
    const contact = entry.contacts?.[0];

    if (!msg) return 'ignored';

    const from = msg.from;
    const text = msg.text?.body?.trim() || '';
    const lower = text.toLowerCase();
    const messageId = msg.id;

    // Extract name
    const profileName = contact?.profile?.name ?? 'there';
    const firstName = profileName.split(' ')[0];

    /** ======================================================
     * 1️⃣ FLOW SUBMISSION RESPONSE (highest priority)
     * ====================================================== */
    if (flowResponse) return this.handleFlowSubmission(from, flowResponse, messageId);

    /** ======================================================
     * 2️⃣ TRANSFER SESSION ROUTER
     * ====================================================== */
    const session = await this.cache.get(`tx:${from}`);
    if (session) return this.routeTransferSession(session, from, text);

    /** ======================================================
     * 3️⃣ INTERACTIVE MENU SELECTED
     * ====================================================== */
    if (msg.type === 'interactive' && msg.interactive?.type === 'list_reply') {
      return this.handleMenuSelection(from, msg.interactive.list_reply.id, messageId);
    }

    /** ======================================================
     * 4️⃣ EXPLICIT HELP / MENU COMMAND
     * ====================================================== */
    if (lower === 'help' || lower === 'menu') {
      await this.typing(from, messageId);
      return this.whatsappApi.sendMenu(from, messageId);
    }

    /** ======================================================
     * 5️⃣ CHECK USER (NEW OR EXISTING)
     * ====================================================== */
    const user = await this.userService.findByPhone(from);

    // NEW USER → Onboarding template
    if (!user) {
      await this.typing(from, messageId);
      return this.whatsappApi.sendOnboardingTemplate(from, firstName);
    }

    /** ======================================================
     * 6️⃣ NATURAL LANGUAGE TRANSFER ("transfer 5k to 0023…")
     * ====================================================== */
    if (lower.startsWith('transfer') || lower.startsWith('send')) {
      return this.handleNaturalTransfer(from, text);
    }

    /** ======================================================
     * 7️⃣ PIN HANDLING
     * ====================================================== */
    if (/^\d{4}$/.test(text)) {
      return this.handlePinConfirmation(from, text);
    }

    /** ======================================================
     * 8️⃣ SAVE BENEFICIARY
     * ====================================================== */
    if (lower === 'yes') {
      return this.handleSaveBeneficiary(from);
    }

    /** ======================================================
     * 9️⃣ FALLBACK → SHOW MENU
     * ====================================================== */
    await this.typing(from, messageId);
    return this.whatsappApi.sendMenu(from, messageId);
  }

  /* -------------------------------------------------------
     🌟 FLOW HANDLER
  -------------------------------------------------------- */
  private async handleFlowSubmission(from: string, flow: any, messageId: string) {
    const flowData = flow.data || {};
    this.logger.log(`📄 Flow submitted by ${from}`);
    this.logger.debug(flowData);

    try {
      await this.userService.onboardUser(from, flowData);

      await this.typing(from, messageId);
      await this.whatsappApi.sendText(
        from,
        `🎉 *Welcome to Billy!* Your account has been created successfully.`
      );

      return 'flow_onboarding_completed';
    } catch (err) {
      await this.whatsappApi.sendText(from, `⚠️ Onboarding failed: ${err.message}`);
      return 'flow_onboarding_error';
    }
  }

  /* -------------------------------------------------------
     🔄 TRANSFER SESSION ROUTER
  -------------------------------------------------------- */
  private async routeTransferSession(session: any, from: string, text: string) {
    switch (session.step) {
      case 'ENTER_AMOUNT':
        return this.vasService.handleTransferAmount(from, text);

      case 'ENTER_ACCOUNT':
        return this.vasService.handleAccountNumber(from, text);

      case 'ENTER_BANK':
        return this.vasService.handleBankName(from, text);

      case 'CONFIRM':
        return this.vasService.handleTransferConfirmation(from, text);

      case 'ENTER_PIN':
        return this.vasService.handlePinEntry(from, text);
    }
  }

  /* -------------------------------------------------------
     📌 MENU INTERACTION HANDLER
  -------------------------------------------------------- */
  private async handleMenuSelection(from: string, choice: string, messageId: string) {
    this.logger.log(`📌 Menu option selected by ${from}: ${choice}`);

    await this.typing(from, messageId);

    switch (choice) {
      case 'MENU_TRANSFER':
        return this.vasService.startTransferFlow(from, messageId);

      case 'MENU_AIRTIME':
        return this.vasService.startAirtimeFlow(from, messageId);

      case 'MENU_BILLS':
        return this.vasService.startBillsFlow(from, messageId);

      case 'MENU_CRYPTO':
        return this.vasService.startCryptoFlow(from, messageId);

      case 'MENU_BALANCE':
        return this.vasService.getWalletBalance(from, messageId);

      case 'MENU_HELP':
        return this.whatsappApi.sendHelpMenu(from, messageId);

      default:
        await this.whatsappApi.sendText(from, `❗ Invalid option. Please select again.`);
        return this.whatsappApi.sendMenu(from, messageId);
    }
  }

  /* -------------------------------------------------------
     💬 NATURAL LANGUAGE TRANSFER ("transfer 5000 to …")
  -------------------------------------------------------- */
  private async handleNaturalTransfer(from: string, text: string) {
    const res = await this.transferService.startTransfer(from, text);

    if (res.ask) return this.whatsappApi.sendText(from, res.ask);

    if (res.confirm) {
      const { amount, accountName, accountNumber, bankName } = res.confirm;

      await this.whatsappApi.sendText(
        from,
        `🧾 *Transfer Confirmation*\n\n` +
        `Send *₦${amount.toLocaleString()}* to:\n\n` +
        `👤 *${accountName}*\n` +
        `🏦 *${bankName}*\n` +
        `🔢 *${accountNumber}*\n\n` +
        `Enter your *4-digit PIN* to confirm.`
      );

      await this.cache.set(`pending_tx:${from}`, res.confirm);
    }

    return 'processing_transfer';
  }

  /* -------------------------------------------------------
     🔐 PIN ENTRY HANDLER
  -------------------------------------------------------- */
  private async handlePinConfirmation(from: string, pin: string) {
    const pending = await this.cache.get(`pending_tx:${from}`);
    if (!pending) return;

    await this.transferService.verifyPin(from, pin);
    const tx = await this.transferService.executeTransfer(from);

    await this.whatsappApi.sendText(
      from,
      `✅ *Transfer Successful!*\n₦${pending.amount.toLocaleString()} sent to *${pending.accountName}*.`
    );

    await this.whatsappApi.sendText(
      from,
      `💾 Would you like to *save this beneficiary*?\nReply *yes* or *no*.`
    );

    return;
  }

  /* -------------------------------------------------------
     💾 SAVE BENEFICIARY
  -------------------------------------------------------- */
  private async handleSaveBeneficiary(from: string) {
    const pending = await this.cache.get(`pending_tx:${from}`);
    await this.userService.saveBeneficiary(from, pending);

    return this.whatsappApi.sendText(from, `💾 Beneficiary saved successfully!`);
  }

  /* -------------------------------------------------------
     ⏳ Helper: Typing Simulation
  -------------------------------------------------------- */
  private async typing(to: string, messageId: string, delayMs = 900) {
    await this.whatsappApi.sendTypingIndicator(to, messageId);
    await this.delay(delayMs);
  }

  private delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}