import * as crypto from "crypto";
import { Injectable } from "@nestjs/common";
import { FlowsEncryptedDto } from "./dto/flows-encrypted.dto";

@Injectable()
export class WhatsappFlowService {

  private getPrivateKey() {
    const key = process.env.FLOW_PRIVATE_KEY;
    if (!key) throw new Error("FLOW_PRIVATE_KEY is missing");

    return key.replace(/\\n/g, "\n");
  }

  decryptPayload(dto: FlowsEncryptedDto) {
    try {
      console.log("🔥 RAW FLOW SUBMISSION FROM META:", dto);

      // 1️⃣ Decrypt AES key using RSA-OAEP-SHA256
      const aesKey = crypto.privateDecrypt(
        {
          key: this.getPrivateKey(),
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        Buffer.from(dto.encrypted_aes_key, "base64"),
      );

      // 2️⃣ AES-256-CBC decrypt (NO TAG IN YOUR PAYLOAD)
      const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        aesKey,
        Buffer.from(dto.initial_vector, "base64"),
      );

      let decrypted =
        decipher.update(dto.encrypted_flow_data, "base64", "utf8");
      decrypted += decipher.final("utf8");

      console.log("🔥 DECRYPTED FLOW PAYLOAD:", decrypted);

      return JSON.parse(decrypted);

    } catch (error) {
      console.error("❌ Decryption failed:", error);
      throw new Error("FAILED_TO_DECRYPT_FLOW_PAYLOAD");
    }
  }

  async processEncryptedSubmission(dto: FlowsEncryptedDto) {
    const decrypted = this.decryptPayload(dto);

    console.log("🚀 Final Decrypted Flow Data:", decrypted);

    // WhatsApp requires a BASE64 encoded success response:
    const responseJson = JSON.stringify({ success: true });

    return Buffer.from(responseJson).toString("base64");
  }
}