import { Module } from '@nestjs/common';
import { WhatsappWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsappService } from './services/whatsapp.service';
import { WhatsappSenderService } from './services/whatsapp-sender.service';
import { WhatsappFlowService } from './services/whatsapp-flow.service';
import { UsersModule } from '../users/users.module';
import { LlmModule } from '../llm/llm.module';
import { WhatsappCryptoService } from './services/whatsapp-crypto.service';

@Module({
  imports: [UsersModule, LlmModule],
  controllers: [WhatsappWebhookController],
  providers: [WhatsappService,WhatsappCryptoService, WhatsappSenderService, WhatsappFlowService],
})
export class WhatsappModule {}
