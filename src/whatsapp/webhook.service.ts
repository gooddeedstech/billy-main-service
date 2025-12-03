import { Injectable, Logger } from '@nestjs/common';
import { WhatsappApiService } from './whatsapp-api.service';
import { UserService } from '@/flows/on-boading/services/user.service';
import { CacheService } from '@/cache/cache.service';
import { VasService } from '@/billy/vas.service';
import { TransferStepsService } from '@/billy/transfer-steps.service';
import { TransferService } from '@/billy/bank-transfer/transfer.service';
import { FreeTextTransferParserService } from '@/billy/parsed-text/free-text-transfer-parser.service';
import { TransferSession } from '@/billy/bank-transfer/transfer-session.types';

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly whatsappApi: WhatsappApiService,
    private readonly userService: UserService,
    private readonly cache: CacheService,
    private readonly vasService: VasService,
    private readonly transferService: TransferService,
    private readonly transferStepsService: TransferStepsService,
    private readonly freeTextTransferParserService: FreeTextTransferParserService
  ) {}

  private readonly transferKeywords = [
  "transfer",
  "send",
  "credit",
  "wire",
  "run",
  "run am",
  "pay",
  "move",
  "drop",
  "dash",
  "gbese",
];

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

      // ------------------------------------
// 🔥 FREE-TEXT TRANSFER DETECTION
// ------------------------------------

const isTransferIntent = this.transferKeywords.some((key) =>
  lower.startsWith(key)
);

if (isTransferIntent) {
  const parsed = this.freeTextTransferParserService.parse(lower);

  // --- Missing Amount ---
  if (!parsed.amount) {
    await this.cache.set(`tx:${from}`, {
      step: "ENTER_AMOUNT",
      data: {},
      createdAt: Date.now(),
    });

    return this.whatsappApi.sendText(
      from,
      `💰 How much do you want to send?\nExample: *10k*, *5000*, *2.5m*\n\nType *cancel* to stop.`
    );
  }

  // --- Missing Account Number ---
  if (!parsed.accountNumber) {
    await this.cache.set(`tx:${from}`, {
      step: "ENTER_ACCOUNT",
      data: { amount: parsed.amount },
      createdAt: Date.now(),
    });

    return this.whatsappApi.sendText(
      from,
      `🔢 Enter the *recipient's account number*.\n\nType *cancel* to stop.`
    );
  }

  // --- Missing Bank Name ---
  if (!parsed.bankText) {
    await this.cache.set(`tx:${from}`, {
      step: "ENTER_BANK",
      data: {
        amount: parsed.amount,
        accountNumber: parsed.accountNumber,
      },
      createdAt: Date.now(),
    });

    return this.whatsappApi.sendText(
      from,
      `🏦 I detected the account number *${parsed.accountNumber}*.\n\nWhich bank?\nType *cancel* to stop.`
    );
  }

  // --- All present → send to full transfer handler ---
  return this.startTransferFlowWithParsedData(from, parsed);
}


        /* ======================================================
     * 🔥 3. ONBOARDING FLOW SUBMISSION (Flow Reply)
     * ====================================================== */
  if (msg.type === 'interactive' && msg.interactive?.type === 'nfm_reply') {
  const rawJson = msg.interactive.nfm_reply.response_json;
  const data = JSON.parse(rawJson);
    this.logger.log(`PIN ${JSON.stringify(data)}`)
  // 🔍 Detect if it's a PIN flow
  if (data.bvn_number) {
    return await this.handleFlowSubmission(from, data, messageId);
   
  }

  // 🔍 Otherwise treat as onboarding flow
   return await this.handlePinFlowSubmission(from, data, messageId);
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
if (lower === 'menu' || lower === 'help' || lower !== '') {
  return this.whatsappApi.sendMenu(from, messageId);
}

// If session exists: NEVER show menu
return 'session_active';
   
  }

  /* ======================================================
   * 🌟 HANDLE SUBMITTED WHATSAPP FLOW (NFM)
   * ====================================================== */
  private async handlePinFlowSubmission(from: string, data: any, messageId: string) {
  this.logger.log("🔐 PIN Flow submitted");

  const session = await this.cache.get(`tx:${from}`);
  if (!session) {
    return await this.whatsappApi.sendText(
      from,
      "❗ No active transaction found. Type *menu* to begin."
    );
  }

  try {
    const pin = data.pin;

    await this.transferStepsService.handleTransferConfirmation(from, pin);
    

    // // Execute transfer

    return "pin_flow_done";

  } catch (err: any) {
    this.logger.error(`❌ PIN Flow Error: ${err.message}`);
    return await this.whatsappApi.sendText(from, `❗ ${err.message}`);
  }
}


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

  private async startTransferFlowWithParsedData(
  phone: string,
  parsed: { amount?: number; accountNumber?: string; bankText?: string }
) {
  // STEP 1 — Check if user exists
  const user = await this.userService.findByPhone(phone);
  if (!user) {
    return this.whatsappApi.sendText(phone, `❗ Please complete onboarding first.`);
  }

  // STEP 2 — Start brand-new transfer session
  const session: TransferSession = {
    step: 'ENTER_AMOUNT',
    data: {},
    createdAt: Date.now(),
  };

  // -------------------------------------------------------
  // 🔍 If AMOUNT is present, set it
  // -------------------------------------------------------
  if (parsed.amount) {
    session.data.amount = parsed.amount;
    session.step = 'ENTER_ACCOUNT';
  }

  // -------------------------------------------------------
  // 🔍 If ACCOUNT NUMBER is present, set it
  // -------------------------------------------------------
  if (parsed.accountNumber) {
    session.data.accountNumber = parsed.accountNumber;
    session.step = session.data.amount ? 'ENTER_BANK' : 'ENTER_AMOUNT';
  }

  // -------------------------------------------------------
  // 🔍 If BANK TEXT exists, store as bank keyword
  // -------------------------------------------------------
  if (parsed.bankText) {
    session.data.bankName = parsed.bankText;
  }

  await this.cache.set(`tx:${phone}`, session);

  // -------------------------------------------------------
  // DECISION TREE
  // -------------------------------------------------------

  // ✔ If ONLY AMOUNT is present → ask account
  if (parsed.amount && !parsed.accountNumber) {
    return this.whatsappApi.sendText(
      phone,
      `🔢 How much do you want to send?\n` +
      `Amount detected: ₦${parsed.amount.toLocaleString()}\n\n` +
      `Now enter the *recipient's 10-digit account number*.\n\nType *cancel* to stop.`
    );
  }

  // ✔ If ACCOUNT ONLY present → ask bank
  if (parsed.accountNumber && !parsed.amount) {
    return this.whatsappApi.sendText(
      phone,
      `💳 Account detected: *${parsed.accountNumber}*\n\n` +
      `How much do you want to transfer?\n\nType *cancel* to stop.`
    );
  }

  // ✔ If BANK ONLY → ask for account or amount depending on presence
  if (parsed.bankText && !parsed.accountNumber) {
    return this.whatsappApi.sendText(
      phone,
      `🏦 Bank detected: *${parsed.bankText}*\n\n` +
      `Please enter the *recipient's account number*.\n\nType *cancel* to stop.`
    );
  }

  // ✔ If all required fields exist → proceed to next missing one
  if (session.step === 'ENTER_BANK') {
    return this.whatsappApi.sendText(
      phone,
      `🏦 Enter the recipient’s *bank name*.\n\nType *cancel* to stop.`
    );
  }

  // ✔ If everything is complete → hand off to bank resolver
  if (parsed.amount && parsed.accountNumber && parsed.bankText) {
    return this.transferStepsService.handleBankName(phone, parsed.bankText);
  }

  // Fallback
  return this.whatsappApi.sendText(
    phone,
    `🤖 I captured some details, but I need more information to complete your transfer.`
  );
}

  /* ======================================================
   * ⏳ Typing Simulation
   * ====================================================== */
  private async typing(to: string, messageId: string, delayMs = 100) {
    await this.whatsappApi.sendTypingIndicator(to, messageId);
    await this.delay(delayMs);
  }

  private delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}