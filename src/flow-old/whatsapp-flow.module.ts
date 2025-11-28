import { Module } from '@nestjs/common';
import { WhatsappFlowController } from './whatsapp-flow.controller';
import { WhatsappFlowService } from './whatsapp-flow.service';

@Module({
  controllers: [WhatsappFlowController],
  providers: [WhatsappFlowService],
})
export class WhatsappFlowModule {}