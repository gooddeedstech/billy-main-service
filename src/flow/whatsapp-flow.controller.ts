import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { WhatsappFlowService } from './whatsapp-flow.service';
import { FlowsEncryptedDto } from './dto/flows-encrypted.dto';

@Controller('whatsapp/flow')
export class WhatsappFlowController {
  constructor(private readonly flowService: WhatsappFlowService) {}

  /**
   * 1) Flow Definition Endpoint
   * GET https://api.usebilly.ai/whatsapp/flow/onboarding
   */
  @Get('onboarding')
  getOnboardingFlow() {
    return this.flowService.getOnboardingFlow();
  }

  /**
   * 2) Encrypted Submission Endpoint
   * POST https://api.usebilly.ai/whatsapp/flow/onboarding/submit
   * Called by WhatsApp when user completes the flow
   */
 @Post('onboarding/submit')
@Post('flow/onboarding')
async submitOnboardingEncrypted(@Body() body: any) {
  const encrypted_flow_data = {
    encrypted_key: body.encrypted_key,
    encrypted_data: body.encrypted_data,
    encrypted_metadata: body.encrypted_metadata,
    iv: body.iv,
    tag: body.tag,
  };

  return this.flowService.processEncryptedSubmission({
    encrypted_flow_data,
  });
}
}