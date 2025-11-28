import { Controller, Get, Query, ForbiddenException, Logger, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { WhatsappWebhookService } from './webhook.service';

@Controller('whatsapp/webhook')
export class WhatsappAPIWebhookController {
  private readonly logger = new Logger(WhatsappAPIWebhookController.name);

  constructor(private readonly webhookService: WhatsappWebhookService) {}

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

  /**
   * REAL WHATSAPP MESSAGES (POST)
   */
 @Post()
@HttpCode(200)
async handleWebhook(
  @Body() body: any,
  @Headers('x-hub-signature-256') signature: string,
) {
  this.logger.debug("📩 Incoming Webhook", JSON.stringify(body, null, 2));

  // Track message statuses
  if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
    const status = body.entry[0].changes[0].value.statuses[0];
    this.logger.log(`📡 Message Status → ${status.status} (ID: ${status.id})`);
  }

  // Track user replies
  if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
    const msg = body.entry[0].changes[0].value.messages[0];
    this.logger.log(`💬 User Message → ${msg.from}: "${msg.text?.body}"`);
  }

  return 'OK';
}

// @Post()
// @HttpCode(200)
// async handleWebhook(@Body() body: any) {
//   this.logger.debug("📨 Incoming WhatsApp Webhook", JSON.stringify(body, null, 2));

//   const entry = body?.entry?.[0];
//   const change = entry?.changes?.[0];
//   const value = change?.value;

//   // 1. Incoming user text message
//   if (value?.messages?.length) {
//     const msg = value.messages[0];

//     this.logger.log(`💬 User Message From ${msg.from}: ${msg.text?.body}`);
//   }

//   // 2. Message status update
//   if (value?.statuses?.length) {
//     const s = value.statuses[0];
//     this.logger.log(`📡 Status Update: ${s.status} for message ID ${s.id}`);
//   }

//   return 'OK';
// }

}