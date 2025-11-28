// src/flow/whatsapp-flow.controller.ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { WhatsappFlowService } from './whatsapp-flow.service';
import { FlowsEncryptedDto } from './dto/flows-encrypted.dto';

@Controller('whatsapp/flow')
export class WhatsappFlowController {
  constructor(private readonly flowService: WhatsappFlowService) {}

  /**
   * Endpoint configured in Meta:
   * https://api.usebilly.ai/whatsapp/flow/onboarding
   *
   * NOTE:
   * - Must return HTTP 200
   * - Body must be plain Base64 string (NOT JSON)
   */
  @Post('onboarding')
  @HttpCode(200) // <-- required, otherwise Nest will send 201
  async submitOnboardingEncrypted(
    @Body() body: FlowsEncryptedDto,
  ): Promise<string> {
    return this.flowService.handleFlowSubmission(body);
  }
}