import { Injectable, Logger } from '@nestjs/common';
import { WhatsappApiService } from './whatsapp-api.service';
import { OnboardingFlowService } from '@/flows/on-boading/onboarding-flow.service';

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  // Add your onboarding triggers here
  private readonly onboardingKeywords = [
    'hi',
    'hello',
    'hey',
    'hey billy',
    'start',
    'get started',
    'begin',
    'billy',
  ];

  constructor(
    private readonly whatsappApi: WhatsappApiService,
    private readonly onboardingFlow: OnboardingFlowService,
    // private readonly billyAi: BillyAiService,
  ) {}

  async handleIncomingWebhook(body: any) {
    try {
      const entry = body?.entry?.[0]?.changes?.[0]?.value;
      if (!entry?.messages) return 'ignored';

      const msg = entry.messages[0];
      const from = msg.from; // 234XXXXXXXXXX
      const type = msg.type;

      let text = '';

      // -------------------------------------------------
      // Extract message text depending on message type
      // -------------------------------------------------
      if (type === 'text') {
        text = msg.text?.body || '';
      } else if (type === 'interactive') {
        if (msg.interactive.button_reply)
          text = msg.interactive.button_reply.title;
        if (msg.interactive.list_reply)
          text = msg.interactive.list_reply.title;
      }

      text = text.trim().toLowerCase();

      this.logger.log(`💬 Incoming from ${from}: "${text}" (type=${type})`);

      // -------------------------------------------------
      // 1️⃣ Check if user exists in your system
      // -------------------------------------------------
      let existingUser = null; 
      // existingUser = await this.usersService.findByPhone(from);

      // -------------------------------------------------
      // 2️⃣ If user is new OR using onboarding keywords
      // -------------------------------------------------
      const isOnboardingTrigger = this.onboardingKeywords.some(
        (kw) => text.includes(kw)
      );

      if (!existingUser || isOnboardingTrigger) {
        this.logger.log(`🚀 Starting onboarding flow for: ${from}`);

        await this.onboardingFlow.startOnboardingFlow(from);
        return;
      }

      // -------------------------------------------------
      // 3️⃣ User is registered → Forward to Billy AI
      // -------------------------------------------------

      // const aiResponse = await this.billyAi.processMessage({
      //   phone: from,
      //   message: text,
      // });

      // await this.whatsappApi.sendText(from, aiResponse);

      // TEMP (until Billy AI is connected)
      await this.whatsappApi.sendText(
        from,
        `🤖 Billy here!

I'm ready to help with transfers, airtime, bills, crypto, and more.`
      );

      return 'ok';

    } catch (err) {
      this.logger.error('❌ Webhook error:', err);
      return 'error';
    }
  }
}