import { Injectable, Logger } from '@nestjs/common';
import { WhatsappApiService } from './whatsapp-api.service';
import { UsersService } from '@/users/users.service';
import { OnboardingFlowService } from '@/flows/on-boarding/onboarding-flow.service';


@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly whatsappApi: WhatsappApiService,
    private readonly usersService: UsersService,
    private readonly onboardingFlow: OnboardingFlowService,
    // private readonly billyAi: BillyAiService,
  ) {}

  async handleIncomingWebhook(body: any) {
    const entry = body?.entry?.[0]?.changes?.[0]?.value;

    if (!entry?.messages) return 'ignored';

    const msg = entry.messages[0];
    const from = msg.from; // 234XXXXXXXXXX
    const text = msg.text?.body?.trim().toLowerCase() || '';

    this.logger.log(`💬 Incoming from ${from}: ${text}`);

    // -------------------------------
    // 1️⃣ Check if user exists
    // -------------------------------
    const existing = await this.usersService.findByPhone(from);

    if (!existing) {
      this.logger.log(`🆕 New user detected: ${from}`);
      
      // Only start flow on certain triggers
      if (['hi', 'hello', 'start', 'get started', 'billy'].includes(text)) {
        await this.onboardingFlow.startOnboardingFlow(from);
        return;
      }

      // If they haven’t said a keyword, politely push them
      await this.whatsappApi.sendText(
        from,
        `👋 Hi! I’m *Billy*, your AI financial assistant.

To get started, reply with *hi* or *start*.`
      );
      return;
    }

    // -------------------------------
    // 2️⃣ User is onboarded → forward to Billy AI
    // -------------------------------
    // const aiResponse = await this.billyAi.processMessage({
    //   phone: from,
    //   message: text,
    // });
    let aiResponse
    await this.whatsappApi.sendText(from, aiResponse);

    return;
  }
}