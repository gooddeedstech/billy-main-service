import { Body, Controller, Post } from '@nestjs/common';
import { WhatsappFlowService } from './whatsapp-flow.service';
import { FlowsEncryptedDto } from './dto/flows-encrypted.dto';

@Controller('whatsapp/flow')
export class WhatsappFlowController {
  constructor(private readonly flowService: WhatsappFlowService) {}

@Post('onboarding')
async submitOnboardingEncrypted(@Body() dto: any) {
    console.log("🔥 RAW FLOW SUBMISSION FROM META:", JSON.stringify(dto, null, 2));
  return this.flowService.processEncryptedSubmission(dto);
}
}