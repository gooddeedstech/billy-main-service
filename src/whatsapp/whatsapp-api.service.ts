import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WhatsappApiService {
  private readonly logger = new Logger(WhatsappApiService.name);

  private readonly token = process.env.WHATSAPP_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID; // Example: "1234567890"
  private readonly apiUrl = `https://graph.facebook.com/v24.0/${this.phoneNumberId}/messages`;

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
   } catch (error) {
  this.logger.error('❌ Failed to send text:', 
    JSON.stringify(error.response?.data || error, null, 2)
  );
}
  }

  /**
   * 🟦 SEND FLOW MESSAGE (Onboarding Flow Start)
   */
async sendFlowMessage(params: {
  to: string;
  flowName: string;   // e.g. billy_onboarding_v1
  flowCTA: string;    // e.g. Start
  flowVersion?: string; // default: 3
}) {
  const { to, flowName, flowCTA, flowVersion = "3" } = params;

  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',

      interactive: {
        type: 'flow',

       header: { 
  type: 'text', 
  text: '🚀 Billy Onboarding' 
},
body: {
  text: 
    'Welcome to Billy — your secure, AI-powered financial assistant. 🤖✨<br><br>' +
    'With Billy, you can effortlessly transfer money, pay bills, buy airtime & data, and manage your daily finances with ease. 💳⚡<br><br>' +
    'You can also trade crypto securely — buy, sell, and convert funds instantly at the best rates. 🚀💱<br><br>' +
    'Let’s complete your onboarding to unlock all features.'
},
footer: { 
  text: '🔒 Powered by Gooddeeds' 
},

        action: {
          name: 'flow',
          parameters: {
            flow_message_version: flowVersion,
            flow_name: flowName,
            flow_cta: flowCTA,
          }
        }
      }
    };

    await firstValueFrom(
      this.http.post(this.apiUrl, payload, { headers: this.headers() })
    );

    this.logger.log(`🚀 Flow triggered successfully for ${to}`);

  } catch (error) {
    this.logger.error(
      `❌ Failed to start WhatsApp Flow: ${JSON.stringify(error.response?.data || error)}`
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

  async sendTypingIndicator(to: string, messageId: string) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: {
        type: 'text'
      },
    };

    await firstValueFrom(
      this.http.post(
        this.apiUrl,   // same URL used for sending messages
        payload,
        { headers: this.headers() }
      ),
    );

    this.logger.log(`🟢 Typing indicator sent to ${to}`);
  } catch (error) {
    this.logger.error(
      `❌ Failed to send typing indicator: ${JSON.stringify(error.response?.data || error)}`,
    );
  }
}
}