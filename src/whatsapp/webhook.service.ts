import { Injectable, Logger } from '@nestjs/common';
import { WhatsappApiService } from './whatsapp-api.service';
import { OnboardingFlowService } from '@/flows/on-boading/onboarding-flow.service';

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
    // private readonly billyAi: BillyAiService,
  ) {}

  async handleIncomingWebhook(body: any) {
    const entry = body?.entry?.[0]?.changes?.[0]?.value;
    if (!entry?.messages) return 'ignored';

    const msg = entry.messages[0];
    const from = msg.from; // WhatsApp number (234XXXXXXXXXX)
    const text = (msg.text?.body || '').trim().toLowerCase();

    this.logger.log(`💬 Incoming from ${from}: ${text}`);

    // 👉 Replace this with your real DB lookup
    const user = await this.findUserByPhone(from);

    const isOnboardingKeyword = this.onboardingTriggers.includes(text);

    /**
     * 1️⃣ BRAND-NEW USER OR NOT FOUND IN DB
     * -------------------------------------
     */
    if (!user) {
      this.logger.log(`🆕 New user detected: ${from}`);

      if (isOnboardingKeyword) {
        this.logger.log(`🚀 Starting onboarding flow for ${from}`);
        await this.onboardingFlow.startOnboardingFlow(from);
        return 'onboarding_started';
      }

      // No keyword yet → Prompt user nicely
      await this.whatsappApi.sendText(
        from,
        `👋 Hi! I’m *Billy*, your AI financial assistant.

To begin, just reply with *hi* or *start*.`
      );
      return 'prompted_new_user';
    }

    /**
     * 2️⃣ USER EXISTS — CHECK IF HE IS ASKING TO START OVER
     * -----------------------------------------------------
     */
    if (isOnboardingKeyword) {
      this.logger.log(`🔄 Existing user requested onboarding again: ${from}`);
      await this.onboardingFlow.startOnboardingFlow(from);
      return 'onboarding_restarted';
    }

    /**
     * 3️⃣ USER EXISTS → SEND TO AI (MAIN BOT LOGIC)
     * ----------------------------------------------
     */
    // const aiResponse = await this.billyAi.processMessage({ phone: from, message: text });
    // await this.whatsappApi.sendText(from, aiResponse);

    await this.whatsappApi.sendText(
      from,
      `🤖 Billy is live! I will soon connect your query to the AI engine.`
    );

    return 'ai_message_sent';
  }

  /**
   * Temporary mock — replace with real DB lookup
   */
  private async findUserByPhone(phone: string) {
    return null; // ← treat everyone as new for now
  }
}