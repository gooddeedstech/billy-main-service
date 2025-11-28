import * as crypto from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { FlowsEncryptedDto } from "./dto/flows-encrypted.dto";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class WhatsappFlowService {
  private readonly logger = new Logger(WhatsappFlowService.name);

 private getPrivateKey(): string {
  try {
    // __dirname points to /dist/src/... in production
    const keyPath = path.join(__dirname, "../keys/flow_private.pem");

    const key = fs.readFileSync(keyPath, "utf8");

    this.logger.debug("Loaded private key from: " + keyPath);

    return key;
  } catch (e) {
    this.logger.error("❌ Failed to load private key file", e);
    throw e;
  }
}

  decryptPayload(payload: any): any {

    console.log(`MEYI ${payload}`)
    this.logger.debug("Starting decryption...");
    
    try {
      // 1️⃣ RSA decrypt AES key
      const aesKey = crypto.privateDecrypt(
        {
          key: this.getPrivateKey(),
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(payload.encrypted_aes_key, "base64")
      );

      this.logger.debug(`AES key length: ${aesKey.length}`);

      // 2️⃣ AES-256-GCM decrypt flow data
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        aesKey,
        Buffer.from(payload.initial_vector, "base64")
      );

      decipher.setAuthTag(Buffer.from(payload.authentication_tag, "base64"));

      let decrypted =
        decipher.update(payload.encrypted_flow_data, "base64", "utf8");
      decrypted += decipher.final("utf8");

      const json = JSON.parse(decrypted);

      this.logger.debug("Decryption complete:");
      this.logger.debug(JSON.stringify(json, null, 2));

      return json;

    } catch (err) {
      this.logger.error("❌ Decryption failed:", err);
      throw new Error("Failed to decrypt flow payload");
    }
  }

  async processEncryptedSubmission(payload: any) {
    const data = this.decryptPayload(payload);

    // Return a BASE64 encoded success response
    const response = JSON.stringify({ success: true });

    return Buffer.from(response).toString("base64");
  }
}