import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { OnboardingUser } from '@/entities/users.entity';
import { Repository } from 'typeorm';

@Injectable()
export class WhatsappApiService {
  private readonly logger = new Logger(WhatsappApiService.name);

  private readonly token = process.env.WHATSAPP_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID; // Example: "1234567890"
  private readonly apiUrl = `https://graph.facebook.com/v24.0/${this.phoneNumberId}/messages`;

  constructor(
    private readonly http: HttpService,
    @InjectRepository(OnboardingUser)
    private readonly userRepo: Repository<OnboardingUser>,
  ) {}

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
    "\n\nWelcome to Billy — your secure, AI-powered financial assistant. 🤖✨\n\n" +
    "With Billy, you can effortlessly transfer money, pay bills, buy airtime & data, and manage your daily finances with ease. 💳⚡\n\n" +
    "You can also trade crypto securely — buy, sell, and convert funds instantly at the best rates. 🚀💱\n\n" +
    "Let’s complete your onboarding to unlock all features.\n\n"
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

async sendOnboardingTemplate(to: string, name: string) {
  console.log(`${to} - ${name}`)
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: "billy_onboarding_start",
        language: { code: "en" },         
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: name || "there"
              }
            ]
          },
          ,
        {
            type: "button",
            sub_type: "flow",
            index: "0"
             
            
        }
        ]
      }
    };

    await firstValueFrom(
      this.http.post(this.apiUrl, payload, { headers: this.headers() })
    );

    this.logger.log(`🚀 Onboarding template sent to ${to}`);
  } catch (error) {
    this.logger.error(
      `❌ Template send failed: ${JSON.stringify(error.response?.data || error)}`
    );
  }
}

async sendVirtualAccountDetails(phoneNumber: string) {
  // 1. Find user
  const user = await this.userRepo.findOne({
    where: { phoneNumber },
  });

  if (!user) {
    throw new BadRequestException('User not found');
  }

  if (!user.virtualAccount) {
    throw new BadRequestException(
      'User does not have a virtual account yet.',
    );
  }

  // 2. Format message
const message =
  `💼 *Fund Your Billy Wallet*\n\n` +
  `To add money to your Billy wallet, simply make a transfer to your personal Billy bank account below:\n\n` +
  `👤 *Account Name:* ${user.virtualAccountName}\n` +
  `🔢 *Account Number:* ${user.virtualAccount}\n` +
  `🏦 *Bank:* Rubies MFB\n\n` +
  `💳 Your wallet will be funded automatically once the transfer is received — no extra steps needed.\n\n` +
  `🚀 Ready when you are! Type *help* if you need assistance.`;

  // 3. Send via WhatsApp
  await this.sendText(phoneNumber, message);

  return {
    success: true,
    message: 'Virtual account details sent to user.',
  };
}

async sendHelpMenu(to: string) {
  try {
    const message =
      `🤖 *Billy Help Center*\n` +
      `I'm here to assist you 24/7! Below are the things I can help you with:\n\n` +

      `💸 *Airtime & Data*\n` +
      `• Buy airtime\n` +
      `• Buy mobile data\n\n` +

      `⚡ *Bills & Utilities*\n` +
      `• Pay electricity bills\n` +
      `• Recharge prepaid meters\n` +
      `• Subscribe to DSTV / GOTV\n\n` +

      `🏦 *Banking Services*\n` +
      `• Transfer money to any bank\n` +
      `• Check wallet balance\n` +
      `• View transaction history\n\n` +

      `💳 *Crypto Services*\n` +
      `• Convert Crypto → Naira\n\n` +

      `👤 *Account & Security*\n` +
      `• Change PIN\n` +
      `• Update account details\n\n` +

      `If you’d like to get started, simply type what you want.\n` +
      `For example:\n` +
      `• *Buy airtime 1k* \n` +
      `• *Transfer 50k to 0123456789 GTBank*\n` +
      `• *Pay electricity 3k*\n\n` +

      `I'm ready when you are! 🚀`;

    await this.sendText(to, message);

  } catch (error) {
    this.logger.error(`❌ Failed to send help menu: ${JSON.stringify(error.response?.data || error)}`);
  }
}

async sendMenu(to: string, messageId?: string) {
  try {
    // Optional typing indicator  
    if (messageId) {
      await this.sendTypingIndicator(to, messageId);
      await new Promise(res => setTimeout(res, 800));
    }

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text:
            "👇 *Welcome to Billy!*\n" +
            "Choose an option to continue:"
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "MENU_TRANSFER", title: "💸 Transfer" } },
            { type: "reply", reply: { id: "MENU_AIRTIME", title: "📱 Airtime/Data" } },
            { type: "reply", reply: { id: "MENU_BILLS", title: "⚡ Bills" } },
            { type: "reply", reply: { id: "MENU_CRYPTO", title: "💱 Crypto" } },
            { type: "reply", reply: { id: "MENU_BALANCE", title: "💰 Check Balance" } },
            { type: "reply", reply: { id: "MENU_SUPPORT", title: "🛟 Support" } }
          ]
        }
      }
    };

    await firstValueFrom(
      this.http.post(this.apiUrl, payload, { headers: this.headers() })
    );

    this.logger.log(`📤 Billy Menu sent to ${to}`);
  } catch (err) {
    this.logger.error(
      `❌ Failed to send menu: ${JSON.stringify(err.response?.data || err)}`
    );
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