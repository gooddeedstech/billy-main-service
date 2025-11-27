import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WhatsappSenderService {
  private readonly logger = new Logger(WhatsappSenderService.name);

  private readonly baseUrl = 'https://graph.facebook.com/v20.0';

  constructor(private readonly configService: ConfigService) {}

  private get phoneNumberId(): string {
    return this.configService.get<string>('whatsapp.phoneNumberId') as string;
  }

  private get authHeader() {
    const token = this.configService.get<string>('whatsapp.token');
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  async sendText(to: string, body: string) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body,
      },
    };

    this.logger.debug(
      `Sending WhatsApp text → to=${to}, body=${body}`,
      WhatsappSenderService.name,
    );

    const res = await axios.post(url, payload, {
      headers: {
        ...this.authHeader,
        'Content-Type': 'application/json',
      },
    });

    return res.data;
  }

  async sendInteractiveFlow(to: string, flowId: string, version: string) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        header: {
          type: 'text',
          text: 'Welcome to Billy 👋',
        },
        body: {
          text: 'Let’s set up your account so you can start buying airtime, data, electricity, and more.',
        },
        footer: {
          text: 'Powered by Gooddeeds Technology',
        },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_id: flowId,
            flow_token: 'onboarding',
            flow_cta: 'Get Started',
            flow_action: 'navigate',
            flow_action_payload: {
              screen: 'start',
            },
          },
        },
      },
    };

    this.logger.debug(
      `Sending onboarding Flow → to=${to}, flowId=${flowId}, version=${version}`,
      WhatsappSenderService.name,
    );

    const res = await axios.post(url, payload, {
      headers: {
        ...this.authHeader,
        'Content-Type': 'application/json',
      },
    });

    return res.data;
  }
}
