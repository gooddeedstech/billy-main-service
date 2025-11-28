import { Body, Controller, Post } from '@nestjs/common';
import { WhatsappFlowService } from './whatsapp-flow.service';
import { FlowsEncryptedDto } from './dto/flows-encrypted.dto';

@Controller('whatsapp/flow')
export class WhatsappFlowController {
  constructor(
    private readonly flowService: WhatsappFlowService,
  ) {}

  @Post('onboarding')
  async submitOnboardingEncrypted(
    @Body() body: FlowsEncryptedDto,
  ) {
    // Process + encrypt response
    const encrypted_response =
      await this.flowService.processEncryptedSubmission(body);

    // IMPORTANT: WhatsApp expects an object with a single Base64 string
    return { encrypted_response };
  }
}