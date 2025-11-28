import * as crypto from "crypto";
import { FlowsEncryptedDto } from "./dto/flows-encrypted.dto";
import { Injectable } from "@nestjs/common";

@Injectable()
export class WhatsappFlowService {

  private getPrivateKey() {
    const key = process.env.FLOW_PRIVATE_KEY;
    if (!key) throw new Error("FLOW_PRIVATE_KEY not set");
    return key.replace(/\\n/g, '\n');
  }

  decryptPayload(body: FlowsEncryptedDto) {
    try {
      // 1️⃣ RSA decrypt AES key
      const aesKey = crypto.privateDecrypt(
        {
          key: this.getPrivateKey(),
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(body.encrypted_aes_key, 'base64'),
      );

      // 2️⃣ AES decrypt flow data (AES-256-CBC)
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        aesKey,
        Buffer.from(body.initial_vector, 'base64'),
      ); 

      let decrypted =
        decipher.update(body.encrypted_flow_data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);

    } catch (err) {
      console.error("Decryption error:", err);
      throw new Error("Failed to decrypt flow payload");
    }
  }

  async processEncryptedSubmission(dto: FlowsEncryptedDto) {
    const decrypted = this.decryptPayload(dto);

    console.log("FLOW DECRYPTED DATA:");
    console.log(decrypted);

    // WhatsApp requires BASE64 response
    const response = JSON.stringify({ success: true });
    return Buffer.from(response).toString("base64");
  }
}