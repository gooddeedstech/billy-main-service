import { Controller, Post, Body, Logger } from "@nestjs/common";
import { WhatsappFlowService } from "./whatsapp-flow.service";
import { FlowsEncryptedDto } from "./dto/flows-encrypted.dto";

@Controller("whatsapp/flow")
export class WhatsappFlowController {
  private readonly logger = new Logger(WhatsappFlowController.name);

  constructor(private readonly flowService: WhatsappFlowService) {}

  @Post("onboarding")
  async submitOnboardingEncrypted(@Body() encrypted: FlowsEncryptedDto) {
    this.logger.log("Received encrypted WhatsApp flow submission...");
    console.log(JSON.stringify(encrypted))
    const result = await this.flowService.processEncryptedSubmission(encrypted);

    return result; // MUST be base64 encoded
  }
}