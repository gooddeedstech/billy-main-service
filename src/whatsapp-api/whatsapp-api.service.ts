import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WhatsappApiService {
  private readonly logger = new Logger(WhatsappApiService.name);

  private readonly token = process.env.WHATSAPP_ACCESS_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID; // Example: "1234567890"
  private readonly apiUrl = `https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`;

  constructor(private readonly http: HttpService) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 🟢 SEND SIMPLE TEXT MESSAGE
   */
  async sendText(to: string, message: string) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      };

      await firstValueFrom(this.http.post(this.apiUrl, payload, { headers: this.headers() }));
      this.logger.log(`📩 Sent text to ${to}`);
    } catch (err) {
      this.logger.error(`❌ Failed to send text: ${err.response?.data || err.message}`);
    }
  }

  /**
   * 🟦 SEND FLOW MESSAGE (Onboarding Flow Start)
   */
  async sendFlowMessage(params: {
    to: string;
    flowId: string;
    bodyText?: string;
  }) {
    const { to, flowId, bodyText } = params;

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'flow',
          header: {
            type: 'text',
            text: 'Billy Onboarding',
          },
          body: {
            text: bodyText || 'Let’s get you started with Billy 🚀',
          },
          action: {
            name: 'flow',
            flow: {
              flow_id: flowId,
              mode: 'draft', // change to "published" in production
            },
          },
        },
      };

      await firstValueFrom(this.http.post(this.apiUrl, payload, { headers: this.headers() }));

      this.logger.log(`🚀 Flow started for ${to}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to start onboarding flow: ${JSON.stringify(error.response?.data || error)}`,
      );
    }
  }

  /**
   * 🟤 SEND TEMPLATE MESSAGE (e.g. OTP, Welcome)
   */
  async sendTemplate(to: string, templateName: string, languageCode = 'en_US', components = []) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      };

      await firstValueFrom(this.http.post(this.apiUrl, payload, { headers: this.headers() }));
      this.logger.log(`📨 Template "${templateName}" sent to ${to}`);
    } catch (err) {
      this.logger.error(`❌ Template send error: ${err.response?.data || err.message}`);
    }
  }
}