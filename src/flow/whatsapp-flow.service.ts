import * as crypto from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class WhatsappFlowService {
  private readonly logger = new Logger(WhatsappFlowService.name);

  private getPrivateKey(): string {
    const keyPath = path.join(__dirname, "..", "keys", "flow_private.pem");

    this.logger.debug(`🔑 Loading private key from: ${keyPath}`);

    try {
      const pem = fs.readFileSync(keyPath, "utf8");
      this.logger.debug("🔑 Private key loaded");
      return pem;
    } catch (error) {
      this.logger.error("❌ Failed to load private key file");
      throw error;
    }
  }

  decryptPayload(payload: any) {
    this.logger.debug("Starting decryption...");

    try {
      /** 1️⃣ RSA-OAEP-SHA256 decrypt AES key */
      const aesKey = crypto.privateDecrypt(
        {
          key: this.getPrivateKey(),
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",     // <-- REQUIRED FOR WHATSAPP
        },
        Buffer.from(payload.encrypted_aes_key, "base64")
      );

      this.logger.debug(`AES key length: ${aesKey.length}`);

      /** 2️⃣ AES-256-CBC decrypt payload */
      const decipher = crypto.createDecipheriv(
        "aes-256-cbc",                                   // <-- FIXED MODE
        aesKey,
        Buffer.from(payload.initial_vector, "base64")
      );

      let decrypted =
        decipher.update(payload.encrypted_flow_data, "base64", "utf8");
      decrypted += decipher.final("utf8");

      const json = JSON.parse(decrypted);

      this.logger.debug("Decryption complete:");
      this.logger.debug(JSON.stringify(json, null, 2));

      return json;

    } catch (err) {
      this.logger.error("❌ Decryption failed");
      this.logger.error(err);
      throw new Error("Failed to decrypt flow payload");
    }
  }

  async processEncryptedSubmission(payload: any) {
    const data = this.decryptPayload(payload);
let responseJson: any;
       if (data.action === 'ping') {
      responseJson = {
        version: '3.0',
        action: 'pong',
      };
    } else {
      // 🔧 Example payload for real flows – adjust later
      responseJson = {
        
      };
    }

    // WhatsApp expects base64 encoded response
    return Buffer.from(JSON.stringify({ success: true })).toString("base64");
  }
}