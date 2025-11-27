import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { LlmService } from '../../llm/llm.service';
import { WhatsappFlowService } from './whatsapp-flow.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { WhatsAppIncomingMessage } from '../interfaces/whatsapp-message.interface';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly llmService: LlmService,
    private readonly flowService: WhatsappFlowService,
    private readonly sender: WhatsappSenderService,
  ) {}

  async handleIncoming(message: WhatsAppIncomingMessage) {
    this.logger.debug(
      `Incoming message → from=${message.from}, type=${message.type}`,
    );

    if (message.type === 'flow_completion') {
      return this.handleFlowCompletion(message);
    }

    if (message.type === 'text') {
      return this.handleTextMessage(message);
    }

    return;
  }

  private async handleTextMessage(message: WhatsAppIncomingMessage) {
    const { from } = message;
    const text = (message as any).text?.body || '';

    if (/^hi$|^hello$|^hey$/i.test(text.trim())) {
      await this.sender.sendText(
        from,
        'Hi, I am Billy – your smart AI financial assistant. Let me check if you already have an account…',
      );
    }

    const user = await this.usersService.findByPhone(from);

    if (!user) {
      this.logger.log(`New user detected → phone=${from} → sending Flow`);
      return this.flowService.sendOnboardingFlow(from);
    }

    const reply = await this.llmService.processUserMessage({
      from,
      text,
      userId: user.id,
    });

    return this.sender.sendText(from, reply);
  }

  private async handleFlowCompletion(
    message: WhatsAppIncomingMessage,
  ): Promise<void> {
    const { from } = message;
    const data = (message as any).flow?.data || {};

    this.logger.log(
      `Flow completion received → from=${from}, data=${JSON.stringify(data)}`,
    );

    const user = await this.usersService.createFromFlow(from, data);

    await this.sender.sendText(
      from,
      `🎉 Welcome ${user.fullName || ''}! Your Billy account is ready.

You can say things like:
• "Buy 2k airtime for 0803…"
• "Pay my PHCN bill"
• "Buy data 3GB for MTN"

How can I help you right now?`,
    );
  }
}
