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
    @Body() body,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    this.logger.debug('📥 Incoming WhatsApp Webhook');
    return this.webhookService.handleIncomingWebhook(body);
  }
}