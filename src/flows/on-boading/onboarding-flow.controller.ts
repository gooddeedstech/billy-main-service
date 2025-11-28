import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { OnboardingFlowService } from './onboarding-flow.service';
import { MetaFlowEncryptedDto } from './dtos/meta-flow-encrypted.dto';



@Controller('whatsapp/flow')
export class OnboardingFlowController {
  constructor(
    private readonly onboardingFlowService: OnboardingFlowService,
  ) {}

  /**
   * This URL must match the Endpoint URL configured in the Flow in Meta:
   * e.g. https://api.your-domain.com/whatsapp/flows/onboarding
   */
  @Post('onboarding')
  @HttpCode(200) // Meta expects HTTP 200
  async handleOnboardingEncrypted(
    @Body() body: MetaFlowEncryptedDto,
  ): Promise<string> {
    return this.onboardingFlowService.handleEncryptedSubmission(body);
  }
}  