import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../services/whatsapp.service';
import { WebhookEventDto } from '../dto/webhook-event.dto';
import { WhatsAppIncomingMessage } from '../interfaces/whatsapp-message.interface';

@Controller('whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const expectedToken = this.configService.get<string>(
      'whatsapp.verifyToken',
    );

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Webhook verified successfully');
      return challenge || '';
    }

    this.logger.warn(
      `Webhook verification failed → mode=${mode}, token=${verifyToken}`,
    );
    throw new ForbiddenException('Invalid verify token');
  }

  @Post('webhook')
  async handleWebhook(@Body() body: WebhookEventDto) {
    this.logger.debug(
      `Webhook payload: ${JSON.stringify(body, null, 2)}`,
      WhatsappWebhookController.name,
    );

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const messages = value?.messages;
    if (!messages || messages.length === 0) {
      return { status: 'ignored' };
    }

    for (const msg of messages) {
      const incoming: WhatsAppIncomingMessage = {
        from: msg.from,
        id: msg.id,
        timestamp: msg.timestamp,
        type: msg.type,
        text: msg.text,
        flow: msg.flow,
      } as any;

      await this.whatsappService.handleIncoming(incoming);
    }

    return { status: 'ok' };
  }
}
