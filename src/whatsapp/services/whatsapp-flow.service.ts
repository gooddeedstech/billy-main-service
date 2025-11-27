import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappSenderService } from './whatsapp-sender.service';

@Injectable()
export class WhatsappFlowService {
  private readonly logger = new Logger(WhatsappFlowService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sender: WhatsappSenderService,
  ) {}

  async sendOnboardingFlow(to: string) {
    const flowId = this.configService.get<string>('whatsapp.onboardingFlowId');
    const version = this.configService.get<string>(
      'whatsapp.onboardingFlowVersion',
    );

    if (!flowId) {
      this.logger.error('Onboarding Flow ID not configured');
      return this.sender.sendText(
        to,
        'Sorry, onboarding is temporarily unavailable. Please try again later.',
      );
    }

    return this.sender.sendInteractiveFlow(to, flowId, version || '1.0');
  }
}
