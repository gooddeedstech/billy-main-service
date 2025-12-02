import { Injectable, Logger } from '@nestjs/common';
import { WhatsappApiService } from './whatsapp-api.service';
import { UserService } from '@/flows/on-boading/services/user.service';
import { CacheService } from '@/cache/cache.service';
import { VasService } from '@/billy/vas.service';
import { TransferStepsService } from '@/billy/transfer-steps.service';

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly whatsappApi: WhatsappApiService,
    private readonly userService: UserService,
    private readonly cache: CacheService,
    private readonly vasService: VasService,
    private readonly transferStepsService: TransferStepsService,
  ) {}

  /* ======================================================
   * 📥 MAIN WEBHOOK HANDLER
   * ====================================================== */
  async handleIncomingWebhook(body: any) {
    const entry = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg) return 'ignored';

    const from = msg.from;
    const text = msg.text?.body?.trim() || '';
    const lower = text.toLowerCase();
    const messageId = msg.id;

    this.logger.log(`📩 Incoming: ${from} → ${text}`);

    // ---------------------------------------------------
// 🔥 GLOBAL CANCEL HANDLER — Works Anytime
// ---------------------------------------------------
      if (lower === 'cancel') {
        await this.cache.delete(`tx:${from}`);
        await this.cache.delete(`beneficiary:${from}`);

        await this.whatsappApi.sendText(
          from,
          `❌ *Transfer Cancelled*\nYour session has been cleared.`
        );

        return 'cancelled';
      }
     

    /* ======================================================
     * 🔥 1. ACTIVE TRANSFER SESSION (Redis)
     * ====================================================== */
    const session = await this.cache.get(`tx:${from}`);
    this.logger.log(`🔥 Session ${JSON.stringify(session)}`);

    if (session) {
      this.logger.log(`🔥 Routing transfer step for ${from}: ${session.step}`);
switch (session.step) {
  case 'ENTER_AMOUNT':
    return await this.transferStepsService.handleTransferAmount(from, text);

  case 'ENTER_ACCOUNT':
    return await this.transferStepsService.handleAccountNumber(from, text);

  case 'ENTER_BANK':
    return await this.transferStepsService.handleBankName(from, text);

  case 'CONFIRM_PIN':  // user must enter PIN here
    return await this.transferStepsService.handleTransferConfirmation(from, text);

  case 'ENTER_PIN':    // after PIN validated
    return await this.transferStepsService.handlePinEntry(from, text);

  case 'ASK_SAVE_BENEFICIARY':
    return await this.transferStepsService.handleBeneficiaryDecision(from, text);

  default:
    break;
}
    }

    /* ======================================================
     * 🔥 2. BENEFICIARY YES/NO
     * ====================================================== */
    const pendingBeneficiary = await this.cache.get(`beneficiary:${from}`);

    if (pendingBeneficiary && ['yes', 'no'].includes(lower)) {
      return await this.transferStepsService.handleBeneficiaryDecision(from, lower);
    }

    /* ======================================================
     * 🔥 3. ONBOARDING FLOW SUBMISSION (Flow Reply)
     * ====================================================== */
    if (msg.type === 'interactive' && msg.interactive?.type === 'nfm_reply') {
      const raw = msg.interactive.nfm_reply.response_json;
      const flowData = JSON.parse(raw);

      return await this.handleFlowSubmission(from, flowData, messageId);
    }

    /* ======================================================
     * 🔥 4. HELP & MENU COMMANDS
     * ====================================================== */
    if (['help', 'menu'].includes(lower)) {
      return await this.whatsappApi.sendMenu(from, messageId);
    }

    /* ======================================================
     * 🔥 5. MENU LIST REPLY (buttons)
     * ====================================================== */
    if (msg.type === 'interactive' && msg.interactive?.type === 'list_reply') {
      const choice = msg.interactive.list_reply.id;

      return await this.handleMenuSelection(from, choice, messageId);
    }

    /* ======================================================
     * 🔥 6. USER EXISTENCE CHECK
     * ====================================================== */
    const user = await this.userService.findByPhone(from);
    if (!user) {
      return await this.whatsappApi.sendOnboardingTemplate(from, 'there');
    }

    /* ======================================================
     * 🔥 7. FALLBACK → MENU
     * ====================================================== */
    // if no session: THEN show menu.
if (!session) {
  return await this.whatsappApi.sendMenu(from, messageId);
}

// If session exists: NEVER show menu
return 'session_active';
   
  }

  /* ======================================================
   * 🌟 HANDLE SUBMITTED WHATSAPP FLOW (NFM)
   * ====================================================== */
  private async handleFlowSubmission(from: string, flowData: any, messageId: string) {
    this.logger.log(`📄 Flow submitted by ${from}`);

    try {
      await this.userService.onboardUser(from, flowData);

      await this.typing(from, messageId);
      await this.whatsappApi.sendText(
        from,
        `🎉 *Welcome to Billy!* Your account has been created successfully.`,
      );

      return 'flow_onboarding_completed';
    } catch (error) {
      await this.whatsappApi.sendText(from, `⚠️ Onboarding failed: ${error.message}`);
      return 'flow_onboarding_error';
    }
  }

  /* ======================================================
   * 📌 HANDLE MENU OPTION
   * ====================================================== */
  private async handleMenuSelection(from: string, choice: string, messageId: string) {
    this.logger.log(`📌 Menu option selected: ${from} → ${choice}`);

    await this.typing(from, messageId);

    switch (choice) {
      case 'MENU_TRANSFER':
        return await this.vasService.startTransferFlow(from, messageId);

      case 'MENU_AIRTIME':
        return await this.vasService.startAirtimeFlow(from, messageId);

      case 'MENU_BILLS':
        return await this.vasService.startBillsFlow(from, messageId);

      case 'MENU_CRYPTO':
        return await this.vasService.startCryptoFlow(from, messageId);

      case 'MENU_BALANCE':
        return await this.vasService.getWalletBalance(from, messageId);

      case 'MENU_HELP':
        return await this.whatsappApi.sendHelpMenu(from, messageId);

      default:
        await this.whatsappApi.sendText(from, `❗ Unrecognized option. Try again.`);
        return await this.whatsappApi.sendMenu(from, messageId);
    }
  }

  /* ======================================================
   * ⏳ Typing Simulation
   * ====================================================== */
  private async typing(to: string, messageId: string, delayMs = 400) {
    await this.whatsappApi.sendTypingIndicator(to, messageId);
    await this.delay(delayMs);
  }

  private delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}