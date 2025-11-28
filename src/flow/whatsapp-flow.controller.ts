import { Controller, Post, Body } from '@nestjs/common';
import { WhatsappFlowService } from './whatsapp-flow.service';

@Controller('whatsapp/flow')
export class WhatsappFlowController {
  constructor(private readonly flowService: WhatsappFlowService) {}

  @Post()
  async handleEncryptedFlow(@Body() body: any) {
    return this.flowService.processEncryptedSubmission(body);
  }
}