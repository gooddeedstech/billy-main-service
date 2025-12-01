import { Injectable, Logger } from '@nestjs/common';
import { WhatsappApiService } from './whatsapp-api.service';
import { OnboardingFlowService } from '@/flows/on-boading/onboarding-flow.service';
import { UserService } from '@/flows/on-boading/services/user.service';
import { TransferService } from '@/billy/bank-transfer/transfer.service';
import { CacheService } from '@/cache/cache.service';
import { VasService } from '@/billy/vas.service';

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  // All onboarding triggers
  private readonly onboardingTriggers = [
    'hi',
    'hello',
    'start',
    'get started',
    'hey billy',
    'billy',
    'hey',
    'yo',
  ];

  constructor(
    private readonly whatsappApi: WhatsappApiService,
    private readonly onboardingFlow: OnboardingFlowService,
    private readonly userService: UserService,
    private readonly transferService: TransferService,
    private readonly cache: CacheService,
    private readonly vasService: VasService,
    // private readonly billyAi: BillyAiService,
  ) {}

  async handleIncomingWebhook(body: any) {
  this.logger.debug('📥 Incoming WhatsApp Webhook');

  const entry = body?.entry?.[0]?.changes?.[0]?.value;
  if (!entry) return 'ignored';

  const msg = entry.messages?.[0];
  const flow = entry.interactive?.flow_response;
  const contact = entry.contacts?.[0];

  if (!msg) return 'ignored';

  const from = msg.from;
  const text = msg.text?.body?.trim() || '';
  const lower = text.toLowerCase();
  const messageId = msg.id;

  /** -------------------------------------------------------
   * 🧩 A. FLOW SUBMISSION HANDLING
   * ------------------------------------------------------- */
  if (flow) {
    const flowData = flow.data || {};
    this.logger.log(`📄 Flow submitted by ${from}`);
    
    try {
      await this.userService.onboardUser(from, flowData);

      await this.whatsappApi.sendTypingIndicator(from, messageId);
      await this.delay(900);

      await this.whatsappApi.sendText(
        from,
        `🎉 *Welcome to Billy!* Your account has been created successfully.`
      );

      return 'flow_onboarding_completed';
    } catch (error) {
      await this.whatsappApi.sendText(
        from,
        `⚠️ Onboarding failed: ${error.message}`
      );
      return 'flow_onboarding_error';
    }
  }

  /** -------------------------------------------------------
   * 🧩 B. Extract User First Name
   * ------------------------------------------------------- */
  const profileName = contact?.profile?.name ?? 'there';
  const firstName = profileName.split(' ')[0];

  this.logger.log(`💬 From ${from}: ${text}`);

  /** -------------------------------------------------------
   * 🆘 C. HELP EXPLICIT COMMAND
   * ------------------------------------------------------- */
  if (lower === 'help' || lower === 'menu') {
    await this.whatsappApi.sendMenu(from, messageId);
    return 'menu_explicit';
  }

  /** -------------------------------------------------------
   * 🧑‍💼 D. Check User Existence
   * ------------------------------------------------------- */
  const user = await this.userService.findByPhone(from);
  const isNewUser = !user;

  /** -------------------------------------------------------
   * 🆕 E. New User → Start Onboarding
   * ------------------------------------------------------- */
  if (isNewUser) {
    this.logger.log(`🆕 New user detected: ${from}`);

    await this.whatsappApi.sendTypingIndicator(from, messageId);
    await this.delay(1000);

    await this.whatsappApi.sendOnboardingTemplate(from, firstName);
    return 'onboarding_started';
  }

  /** -------------------------------------------------------
   * ️⃣ F. MENU NUMBER HANDLING
   * ------------------------------------------------------- */
 // Handle Button Selections
if (msg.type === 'interactive' && msg.interactive.type === 'button_reply') {
  const optionId = msg.interactive.button_reply.id;

  this.logger.log(`🔘 User selected: ${optionId}`);
  const messageId = msg.id

  switch (optionId) {
    case 'MENU_TRANSFER':
      return await this.transferService.startTransfer(user.phoneNumber, messageId);

    case 'MENU_AIRTIME':
      return await this.vasService.startAirtimeFlow(user.phoneNumber, messageId);

    case 'MENU_BILLS':
      return await this.vasService.startBillsFlow(user.phoneNumber, messageId);

    case 'MENU_CRYPTO':
      return await this.vasService.startCryptoFlow(user.phoneNumber, messageId);

    case 'MENU_BALANCE':
      return await this.vasService.getWalletBalance(user.phoneNumber, messageId);

    case 'MENU_SUPPORT':
      return await this.whatsappApi.sendText(
        from,
        "🛟 *Support*\nHow can I assist you?"
      );

    default:
      return await this.whatsappApi.sendMenu(from, messageId); // fallback
  }
}

if (text.startsWith('transfer') || text.startsWith('send')) {

   const res = await this.transferService.startTransfer(from, text);

   if (res.ask) {
     return await this.whatsappApi.sendText(from, res.ask);
   }

   if (res.confirm) {
     const { amount, accountName, accountNumber, bankName } = res.confirm;

     await this.whatsappApi.sendText(
       from,
       `🧾 *Transfer Confirmation*\n\n` +
       `You are about to send *₦${amount.toLocaleString()}* to:\n\n` +
       `👤 *${accountName}*\n` +
       `🏦 *${bankName}*\n` +
       `🔢 *${accountNumber}*\n\n` +
       `Please enter your *4-digit PIN* to confirm.`
     );
     await this.cache.set(`pending_tx:${from}`, res.confirm);

   }

   return 'processing_transfer';
}

if (/^\d{4}$/.test(text)) {
  
  const pending = await this.cache.get(`pending_tx:${from}`);
  if (!pending) return;

  await this.transferService.verifyPin(from, text);

  const tx = await this.transferService.executeTransfer(from);

  await this.whatsappApi.sendText(
    from,
    `✅ *Transfer Successful!*\n\n` +
    `₦${pending.amount.toLocaleString()} sent to *${pending.accountName}*`
  );

  // Ask to save beneficiary
  await this.whatsappApi.sendText(
    from,
    `💾 Would you like to *save this person* as a beneficiary?\nReply *yes* or *no*`
  );

  return;
}

if (text === 'yes') {
  const pending = await this.cache.get(`pending_tx:${from}`);
  await this.userService.saveBeneficiary(from, pending);

  await this.whatsappApi.sendText(
    from,
    `💾 Beneficiary saved successfully!`
  );
}

  /** -------------------------------------------------------
   * 🧭 H. FALLBACK → SHOW MENU (instead of random AI)
   * ------------------------------------------------------- */
  await this.whatsappApi.sendTypingIndicator(from, messageId);
  await this.delay(700);

  await this.whatsappApi.sendMenu(from, messageId);

  return 'fallback_menu_displayed';
}


private delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


}