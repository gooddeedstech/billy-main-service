import { Body, Controller, Post, Headers, HttpCode, Logger } from '@nestjs/common';
import { WhatsappWebhookService } from './webhook.service';


@Controller('whatsapp/webhook')
export class WhatsappAPIWebhookController {

  constructor(private readonly webhookService: WhatsappWebhookService) {}
  private readonly logger = new Logger(WhatsappAPIWebhookController.name);

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() body,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    this.logger.debug('📥 Incoming WhatsApp Webhook');

    // Optional: add signature verification here

    return this.webhookService.handleIncomingWebhook(body);
  }


}