import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { WhatsappFlowService } from './whatsapp-flow.service';

@Controller('whatsapp/flow')
export class WhatsappFlowController {
  constructor(private readonly flowService: WhatsappFlowService) {}

  @Post()
@HttpCode(200)   
async handleEncryptedFlow(@Body() payload: any) {
  const encrypted = await this.flowService.processEncryptedSubmission(payload);
  return encrypted;   
}
}