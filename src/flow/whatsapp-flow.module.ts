import { Module } from '@nestjs/common';
import { WhatsappFlowService } from './whatsapp-flow.service';
import { WhatsappFlowController } from './whatsapp-flow.controller';

@Module({
  controllers: [WhatsappFlowController],
  providers: [WhatsappFlowService],
})
export class WhatsappFlowModule {}