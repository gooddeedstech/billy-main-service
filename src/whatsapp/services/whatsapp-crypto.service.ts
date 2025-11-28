import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class WhatsappCryptoService {
  private readonly logger = new Logger(WhatsappCryptoService.name);
  private readonly privateKey: Buffer;

  constructor() {
    const keyFromEnv = process.env.WHATSAPP_PRIVATE_KEY;

    if (keyFromEnv) {
      this.privateKey = Buffer.from(keyFromEnv.replace(/\\n/g, '\n'), 'utf8');
    } else {
      const keyPath =
        process.env.WHATSAPP_PRIVATE_KEY_PATH ??
        path.join(process.cwd(), 'whatsapp-private-key.pem');

      this.privateKey = fs.readFileSync(keyPath);
    }
  }

  /**
   * Decrypt the symmetric key that Meta sends (encrypted with your public key).
   * Adjust padding / OAEP hash according to the docs.
   */
  decryptSymmetricKey(encryptedKeyB64: string): Buffer {
    const encryptedKey = Buffer.from(encryptedKeyB64, 'base64');

    // BE SURE this matches the spec in the docs (OAEP + SHA256 is usually used).
    const symmetricKey = crypto.privateDecrypt(
      {
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedKey,
    );

    return symmetricKey; // e.g. 32-byte AES key
  }

  /**
   * Decrypt AES-GCM payload from Meta.
   * 'cipherTextB64', 'ivB64', 'tagB64' names should be matched to the docs.
   */
  decryptAesGcmPayload(params: {
    cipherTextB64: string;
    ivB64: string;
    tagB64: string;
    symmetricKey: Buffer;
  }): string {
    const { cipherTextB64, ivB64, tagB64, symmetricKey } = params;

    const cipherText = Buffer.from(cipherTextB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', symmetricKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherText, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}