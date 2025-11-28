import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
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
  @HttpCode(200)
  async submitOnboardingEncrypted(@Body() body: FlowsEncryptedDto) {
    return this.flowService.processEncryptedSubmission(body);
  }

  /**
   * 3) Test endpoint (NO encryption) - for local dev
   * You can POST the decrypted JSON here to test onboarding + welcome message
   */
  @Post('onboarding/test')
  @HttpCode(200)
  async submitOnboardingPlain(@Body() decryptedBody: any) {
    return this.flowService.processPlainSubmission(decryptedBody);
  }
}