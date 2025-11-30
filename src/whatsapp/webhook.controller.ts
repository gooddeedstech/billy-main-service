import { Controller, Get, Query, ForbiddenException, Logger, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { WhatsappWebhookService } from './webhook.service';
import { WhatsappEventFilterService } from './filters/whatsapp-event-filter.service';

@Controller('whatsapp/webhook')
export class WhatsappAPIWebhookController {
  private readonly logger = new Logger(WhatsappAPIWebhookController.name);
  private readonly processedEvents = new Set<string>();

  constructor(private readonly webhookService: WhatsappWebhookService,
     private readonly filter: WhatsappEventFilterService,
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
  async handleWebhook(@Body() body: any) {
    this.logger.debug('📥 Incoming WhatsApp Webhook');

    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value) return;

      const eventId =
        value?.messages?.[0]?.id ||
        value?.statuses?.[0]?.id ||
        entry.id;

      // 🔁 1. Duplicate filter
      if (this.filter.isDuplicate(eventId, this.processedEvents)) return;

      // 🚫 2. Ignore Business Account Locked
      if (this.filter.isBusinessAccountLockedEvent(change)) return;

      // ⏳ 3. Ignore old events
      const timestamp =
        value?.statuses?.[0]?.timestamp ||
        value?.messages?.[0]?.timestamp;

      if (timestamp && this.filter.isOldEvent(Number(timestamp))) return;

      // 🎯 4. Now process REAL message events
      if (value.messages) {
        const msg = value.messages[0];
        this.logger.log(`💬 New message from ${msg.from}: ${msg.text?.body}`);
        this.webhookService.handleIncomingWebhook(msg.text?.body)
      }

      if (value.statuses) {
        const status = value.statuses[0];
        this.logger.log(
          `📡 Status Update → ID: ${status.id}, Status: ${status.status}`,
        );
      }
    } catch (err) {
      this.logger.error('Webhook parse error', err);
    }
  }

}