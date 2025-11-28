import * as crypto from "crypto";
import { Injectable } from "@nestjs/common";
import { FlowsEncryptedDto } from "./dto/flows-encrypted.dto";

@Injectable()
export class WhatsappFlowService {

  private getPrivateKey() {
    const key = process.env.FLOW_PRIVATE_KEY;
    if (!key) throw new Error("FLOW_PRIVATE_KEY not set");
    return key.replace(/\\n/g, '\n');
  }

  decryptPayload(body: FlowsEncryptedDto) {
    try {

      // 1️⃣ RSA-OAEP-SHA256 decrypt AES key
      const aesKey = crypto.privateDecrypt(
        {
          key: this.getPrivateKey(),
          oaepHash: "sha256",
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(body.encrypted_aes_key, "base64")
      );

      // 2️⃣ AES-256-GCM decrypt data
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        aesKey,
        Buffer.from(body.initial_vector, "base64"),
      );

      decipher.setAuthTag(Buffer.from(body.authentication_tag, "base64"));

      let decrypted =
        decipher.update(body.encrypted_flow_data, "base64", "utf8");
      decrypted += decipher.final("utf8");

      return JSON.parse(decrypted);

    } catch (err) {
      console.error("❌ Decryption failed:", err);
      throw new Error("Failed to decrypt flow payload");
    }
  }

  async processEncryptedSubmission(dto: FlowsEncryptedDto) {
    const decrypted = this.decryptPayload(dto);

    console.log("🔥 DECRYPTED FLOW DATA:", decrypted);

    const response = Buffer.from(JSON.stringify({ success: true })).toString("base64");

    return response;
  }
}