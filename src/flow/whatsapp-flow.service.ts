import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { EncryptedFlowData } from './dto/flows-encrypted.dto';
import * as crypto from 'crypto';

@Injectable()
export class WhatsappFlowService {

  private readonly logger = new Logger(WhatsappFlowService.name);

  private getPrivateKey(): string {
    const key = process.env.FLOW_PRIVATE_KEY;
    if (!key) throw new Error("FLOW_PRIVATE_KEY is not set");

    return key.replace(/\\n/g, '\n'); // Fix formatting from .env
  }

  private decryptPayload(data: EncryptedFlowData): any {
    try {
      const privateKey = this.getPrivateKey();

      // 1️⃣ DECRYPT the AES key using RSA private key
      const decryptedAesKey = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(data.encrypted_key, 'base64'),
      );

      // 2️⃣ DECRYPT the encrypted_data using AES-GCM
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        decryptedAesKey,
        Buffer.from(data.iv, 'base64'),
      );

      decipher.setAuthTag(Buffer.from(data.tag, 'base64'));

      const decrypted =
        decipher.update(data.encrypted_data, 'base64', 'utf8') +
        decipher.final('utf8');

      return JSON.parse(decrypted);

    } catch (error) {
      this.logger.error("Decryption error", error);
      throw new InternalServerErrorException("Failed to decrypt flow payload");
    }
  }

  async processEncryptedSubmission(encrypted: EncryptedFlowData) {
    const decrypted = this.decryptPayload(encrypted);

    this.logger.log("FLOW SUBMISSION RECEIVED:");
    this.logger.log(JSON.stringify(decrypted, null, 2));

    // 🚀 Save to DB or process onboarding here...

    // 3️⃣ WhatsApp REQUIRES Base64 encoded success string
    const response = JSON.stringify({ success: true });

    return Buffer.from(response).toString('base64');
  }
}