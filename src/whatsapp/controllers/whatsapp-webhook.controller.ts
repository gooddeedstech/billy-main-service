import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { WhatsappService } from '../services/whatsapp.service';

@Controller('whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  /**
   * GET webhook for verification
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    this.logger.debug(`Verification request: ${mode} | ${verifyToken}`);

    if (
      mode === 'subscribe' &&
      verifyToken === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      this.logger.debug(`Webhook Verified! Returning challenge.`);
      return challenge;
    }

    this.logger.error(`Invalid verify token: ${verifyToken}`);
    return 'Invalid verify token';
  }

  /**
   * POST webhook for events
   */
  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    this.logger.debug(
      `Incoming Webhook Payload:\n${JSON.stringify(body, null, 2)}`,
    );

    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      const messages = value?.messages || [];

      if (messages.length === 0) {
        return { status: 'ignored' };
      }

      for (const message of messages) {
        await this.whatsappService.handleIncoming({
          from: message.from,
          id: message.id,
          timestamp: message.timestamp,
          type: message.type,
          text: message.text,
          flow: message.flow,
        });
      }

      return { status: 'ok' };
    } catch (error) {
  if (error instanceof Error) {
    this.logger.error(`Webhook error: ${error.message}`);
    return { status: 'error', error: error.message };
  }

  // fallback if error is a string or unknown
  this.logger.error(`Webhook unknown error: ${JSON.stringify(error)}`);
  return { status: 'error', error: 'Unknown error' };
}
  }

}
