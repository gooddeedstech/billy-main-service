// src/flow/whatsapp-flow.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { FlowsEncryptedDto } from './dto/flows-encrypted.dto';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WhatsappFlowService {
  private readonly logger = new Logger(WhatsappFlowService.name);

  /**
   * Load private key either from ENV (FLOW_PRIVATE_KEY)
   * or from a PEM file at dist/keys/flow_private.pem.
   */
  private getPrivateKey(): crypto.KeyObject {
    // 1. ENV first (e.g. Docker secret / platform env)
    const envKey = process.env.FLOW_PRIVATE_KEY;
    if (envKey && envKey.trim().length > 0) {
      this.logger.debug('🔑 Using private key from FLOW_PRIVATE_KEY env');
      const pem = envKey.replace(/\\n/g, '\n');
      return crypto.createPrivateKey(pem);
    }

    // 2. Fallback to PEM file in dist/keys
    const keyPath = path.join(__dirname, '..', 'keys', 'flow_private.pem');
    this.logger.debug(`🔑 Loading private key from: ${keyPath}`);

    const pem = fs.readFileSync(keyPath, 'utf8');
    this.logger.debug('🔑 Private key loaded successfully from file');

    return crypto.createPrivateKey(pem);
  }

  /**
   * Decrypt the request coming from WhatsApp Flows.
   * Returns:
   * - body: decrypted JSON object
   * - aesKey: Buffer (AES-128 key)
   * - iv: Buffer (original IV)
   */
  private decryptRequest(dto: FlowsEncryptedDto): {
    body: any;
    aesKey: Buffer;
    iv: Buffer;
  } {
    const { encrypted_aes_key, encrypted_flow_data, initial_vector } = dto;

    // 1️⃣ Decrypt AES key using RSA-OAEP(SHA-256)
    const privateKey = this.getPrivateKey();

    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encrypted_aes_key, 'base64'),
    );

    this.logger.debug(`🔐 AES key length: ${aesKey.length} bytes`);

    // 2️⃣ Split encrypted_flow_data into body + GCM tag
    const dataBuffer = Buffer.from(encrypted_flow_data, 'base64');
    const TAG_LENGTH = 16; // GCM tag size in bytes

    const bodyPart = dataBuffer.subarray(0, dataBuffer.length - TAG_LENGTH);
    const authTag = dataBuffer.subarray(dataBuffer.length - TAG_LENGTH);

    const iv = Buffer.from(initial_vector, 'base64');

    // 3️⃣ AES-128-GCM decryption
    const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(bodyPart),
      decipher.final(),
    ]);

    const decryptedJson = decryptedBuffer.toString('utf8');
    const body = JSON.parse(decryptedJson);

    this.logger.debug(
      `📥 Decrypted Flow Body: ${JSON.stringify(body, null, 2)}`,
    );

    return { body, aesKey, iv };
  }

  /**
   * Encrypt a JSON response using the same AES key,
   * but with IV bytes bit-flipped, and return Base64 string.
   */
  private encryptResponse(
    responseBody: any,
    aesKey: Buffer,
    iv: Buffer,
  ): string {
    // Flip IV bytes: ~b for each byte
    const flippedIv = Buffer.alloc(iv.length);
    for (let i = 0; i < iv.length; i++) {
      flippedIv[i] = ~iv[i];
    }

    const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);

    const plaintext = Buffer.from(JSON.stringify(responseBody), 'utf8');

    const encryptedBody = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const finalBuffer = Buffer.concat([encryptedBody, authTag]);

    const base64 = finalBuffer.toString('base64');
    this.logger.debug(`📤 Encrypted Flow Response (base64, length=${base64.length})`);

    return base64;
  }

  /**
   * Public method used by the controller.
   * - Decrypt request
   * - Decide what to respond (ping/pong or actual flow)
   * - Encrypt response and return Base64 string
   */
  async handleFlowSubmission(dto: FlowsEncryptedDto): Promise<string> {
    const { body, aesKey, iv } = this.decryptRequest(dto);

    let responseJson: any;

    // ✅ Health check: WhatsApp sends { "version": "3.0", "action": "ping" }
    if (body.action === 'ping') {
      responseJson = {
        version: '3.0',
        action: 'pong',
      };
    } else {
      // 🔧 Example payload for real flows – adjust later
      responseJson = {
        screen: 'SCREEN_NAME',
        data: {
          some_key: 'some_value',
        },
      };
    }

    return this.encryptResponse(responseJson, aesKey, iv);
  }
}