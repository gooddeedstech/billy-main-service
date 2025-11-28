import { Controller, Get, Post, Query, Body, Logger, HttpCode } from '@nestjs/common';
import { WhatsappService } from '../services/whatsapp.service';
import { WhatsappCryptoService } from '../services/whatsapp-crypto.service';
import { FlowsEncryptedDto } from '../dto/flows-encrypted.dto';

@Controller('whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly whatsappService: WhatsappService,
    private readonly cryptoSvc: WhatsappCryptoService
  ) {}

  /**
   * GET webhook for verification
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ) {
    this.logger.debug(`Verification request: ${mode} | ${verifyToken}`);

    if (
      mode === 'subscribe' &&
      verifyToken === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      this.logger.debug(`Webhook Verified! Returning challenge.`);
      return challenge;
    }

    this.logger.error(`Invalid verify token: ${verifyToken}`);
    return 'Invalid verify token';
  }

  /**
   * POST webhook for events
   */
  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    this.logger.debug(
      `Incoming Webhook Payload:\n${JSON.stringify(body, null, 2)}`,
    );

    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      const messages = value?.messages || [];

      if (messages.length === 0) {
        return { status: 'ignored' };
      }

      for (const message of messages) {
        await this.whatsappService.handleIncoming({
          from: message.from,
          id: message.id,
          timestamp: message.timestamp,
          type: message.type,
          text: message.text,
          flow: message.flow,
        });
      }

      return { status: 'ok' };
    } catch (error) {
  if (error instanceof Error) {
    this.logger.error(`Webhook error: ${error.message}`);
    return { status: 'error', error: error.message };
  }

  // fallback if error is a string or unknown
  this.logger.error(`Webhook unknown error: ${JSON.stringify(error)}`);
  return { status: 'error', error: 'Unknown error' };
}
  }


    @Post('flows-callback')
  @HttpCode(200)
  async handleFlowsCallback(@Body() body: FlowsEncryptedDto) {
    // 1. Decrypt symmetric key
    const symmetricKey = this.cryptoSvc.decryptSymmetricKey(body.encrypted_key);

    // 2. Decrypt the main data
    const decryptedDataJson = this.cryptoSvc.decryptAesGcmPayload({
      cipherTextB64: body.encrypted_data,
      ivB64: body.iv,
      tagB64: body.tag,
      symmetricKey,
    });

    // 3. Decrypt metadata if Meta sends it separately
    let decryptedMetadata: any | null = null;
    if (body.encrypted_metadata) {
      const decryptedMetadataJson = this.cryptoSvc.decryptAesGcmPayload({
        cipherTextB64: body.encrypted_metadata,
        ivB64: body.iv,      // or a separate IV for metadata if docs say so
        tagB64: body.tag,    // or its own tag
        symmetricKey,
      });
      decryptedMetadata = JSON.parse(decryptedMetadataJson);
    }

    const decryptedData = JSON.parse(decryptedDataJson);

    // 4. Now you have plain JSON from the flow, do your business logic
    // e.g. read user inputs, save to DB, call Billy tools, etc.
    // console.log({ decryptedData, decryptedMetadata });

    // 5. Return the response expected by Flows (GraphQL / actions),
    // in *plaintext* or encrypted again depending on the doc.
    return {
      success: true,
    };
  }

}
