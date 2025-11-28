// src/flow/whatsapp-flow.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WhatsappFlowService {
  private readonly logger = new Logger(WhatsappFlowService.name);

  private getPrivateKey(): string {
    const keyPath = path.join(__dirname, '..', 'keys', 'flow_private.pem');

    this.logger.debug(`🔑 Loading private key from: ${keyPath}`);

    return fs.readFileSync(keyPath, 'utf8');
  }

  /**
   * MAIN ENTRY: Decrypt request, process, re-encrypt response
   */
  processEncryptedSubmission(payload: any) {
    const privatePem = this.getPrivateKey();

    const {
      decryptedBody,
      aesKeyBuffer,
      initialVectorBuffer,
    } = this.decryptRequest(payload, privatePem);

    this.logger.debug(`Decrypted Flow Body: ${JSON.stringify(decryptedBody)}`);
let responseData
    // Build the next screen response (example; replace with real logic)
   if (decryptedBody.action === 'ping') {
  // Meta health check expected response
  responseData = {
    data: {
      status: 'active',
    },
  };
} else {
  // Normal onboarding flow response
  responseData = {
    screen: 'SCREEN_NAME',
    data: {
      some_key: 'some_value',
    },
  };
}

    return this.encryptResponse(responseData, aesKeyBuffer, initialVectorBuffer);
  }

  /**
   * ========== 🔓 STEP 1: Decrypt Request ==========
   * — RSA-OAEP(SHA-256) for AES key
   * — AES-128-GCM for the flow data
   */
  decryptRequest(body: any, privatePem: string) {
    const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

    // --- RSA DECRYPT AES KEY ---
    const decryptedAesKey = crypto.privateDecrypt(
      {
        key: crypto.createPrivateKey(privatePem),
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encrypted_aes_key, 'base64'),
    );

    // --- AES DECRYPT FLOW BODY ---
    const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
    const initialVectorBuffer = Buffer.from(initial_vector, 'base64');

    // Last 16 bytes = GCM authentication tag
    const TAG_LENGTH = 16;
    const encryptedBody = flowDataBuffer.subarray(0, -TAG_LENGTH);
    const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

    const decipher = crypto.createDecipheriv(
      'aes-128-gcm',
      decryptedAesKey,
      initialVectorBuffer,
    );
    decipher.setAuthTag(authTag);

    const decryptedJSONString = Buffer.concat([
      decipher.update(encryptedBody),
      decipher.final(),
    ]).toString('utf8');

    return {
      decryptedBody: JSON.parse(decryptedJSONString),
      aesKeyBuffer: decryptedAesKey,
      initialVectorBuffer,
    };
  }

  /**
   * ========== 🔒 STEP 2: Encrypt Response ========== 
   * — Flip IV
   * — AES-128-GCM encrypt response
   */
  encryptResponse(response: any, aesKeyBuffer: Buffer, initialVectorBuffer: Buffer) {
    // IV flip (same logic as Meta example)
    const flipped_iv = initialVectorBuffer.map((byte) => ~byte);

    const cipher = crypto.createCipheriv(
      'aes-128-gcm',
      aesKeyBuffer,
      Buffer.from(flipped_iv),
    );

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(response), 'utf8'),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    return encrypted.toString('base64');
  }
}