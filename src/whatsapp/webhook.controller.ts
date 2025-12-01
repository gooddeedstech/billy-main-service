import { Controller, Get, Query, ForbiddenException, Logger, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { WhatsappWebhookService } from './webhook.service';
import { WhatsappEventFilterService } from './filters/whatsapp-event-filter.service';
import { WhatsappApiService } from './whatsapp-api.service';
import { UserService } from '@/flows/on-boading/services/user.service';

@Controller('whatsapp/webhook')
export class WhatsappAPIWebhookController {
  private readonly logger = new Logger(WhatsappAPIWebhookController.name);
  private readonly processedEvents = new Set<string>();

  constructor(private readonly webhookService: WhatsappWebhookService,
     private readonly filter: WhatsappEventFilterService,
     private readonly whatsappApiService: WhatsappApiService,
     private readonly userService: UserService,
  ) {}

  /**
   * META WEBHOOK VERIFICATION (REQUIRED)
   * This is called when you click "Verify and Save".
   */
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ) {
    this.logger.debug('🔍 Webhook verification request received');

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      this.logger.debug('✅ Webhook Verified Successfully');
      return challenge;  // MUST return challenge as plain text
    }

    this.logger.error('❌ Webhook Verification Failed');
    throw new ForbiddenException('Invalid verify token');
  }


@Post()
@HttpCode(200)
async handleIncoming(@Body() body: any) {
  this.logger.debug('📥 Incoming WhatsApp Webhook');
  // console.log(JSON.stringify(body, null, 2)); // Debug body

  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const msg = changes?.value?.messages?.[0];

  if (!msg) return 'OK';

  const from = msg.from;

  // -------------------------------------------------------
  // 1️⃣ HANDLE FLOW SUBMISSION RESPONSE (nfm_reply)
  // -------------------------------------------------------
  if (msg.type === 'interactive' && msg.interactive?.type === 'nfm_reply') {
    this.logger.log('📨 Flow submission received');

    try {
      const rawJson = msg.interactive.nfm_reply.response_json;
      const flowData = JSON.parse(rawJson);

      this.logger.log('🧾 Parsed flow data:', flowData);

      // PROCESS THE FLOW RESULT — SAVE USER, VERIFY PIN, etc.
      await this.userService.onboardUser(from, flowData);

     

      return 'OK';
    } catch (err) {
      this.logger.error('❌ Failed to parse Flow data', err);
      return 'OK';
    }
  }

  // -------------------------------------------------------
  // 2️⃣ NORMAL INCOMING TEXT MESSAGE
  // -------------------------------------------------------

  const messageId = msg.id;
  const text = msg.text?.body;

  // Extract WhatsApp profile name
  const waName = changes?.value?.contacts?.[0]?.profile?.name || null;
  const firstName = waName?.split(' ')?.[0] ?? 'there';

  this.logger.log(`👤 Profile Name Detected: ${firstName}`);

  // Show typing indicator
  await this.whatsappApiService.sendTypingIndicator(from, messageId);
  await this.delay(1000);

  // Send onboarding template
 // await this.whatsappApiService.sendOnboardingTemplate(from, firstName);

  // Continue your internal pipeline (optional)
  await this.webhookService.handleIncomingWebhook(body);

  return 'OK';
}

// Helper
private delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
//  @Post()
//   @HttpCode(200)
//   async handleWebhook(@Body() body: any) {
//     this.logger.debug('📥 Incoming WhatsApp Webhook');
//     console.log(body)
//   return  this.webhookService.handleIncomingWebhook(body)

//     try {
//       const entry = body.entry?.[0];
//       const change = entry?.changes?.[0];
//       const value = change?.value;

//       if (!value) return;

//       const eventId =
//         value?.messages?.[0]?.id ||
//         value?.statuses?.[0]?.id ||
//         entry.id;

//       // 🔁 1. Duplicate filter
//       if (this.filter.isDuplicate(eventId, this.processedEvents)) return;

//       // 🚫 2. Ignore Business Account Locked
//       if (this.filter.isBusinessAccountLockedEvent(change)) return;

//       // ⏳ 3. Ignore old events
//       const timestamp =
//         value?.statuses?.[0]?.timestamp ||
//         value?.messages?.[0]?.timestamp;

//       if (timestamp && this.filter.isOldEvent(Number(timestamp))) return;

//       // 🎯 4. Now process REAL message events
//       if (value.messages) {
//         const msg = value.messages[0];
//         this.logger.log(`💬 New message from ${msg.from}: ${msg.text?.body}`);
//         this.webhookService.handleIncomingWebhook(msg.text?.body)
//       }

//       if (value.statuses) {
//         const status = value.statuses[0];
//         this.logger.log(
//           `📡 Status Update → ID: ${status.id}, Status: ${status.status}`,
//         );
//       }
//     } catch (err) {
//       this.logger.error('Webhook parse error', err);
//     }
//   }

}