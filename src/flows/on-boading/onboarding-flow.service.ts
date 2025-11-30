import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';


// Adjust imports to your actual services
import { MetaFlowEncryptedDto } from './dtos/meta-flow-encrypted.dto';
import { WhatsappApiService } from '@/whatsapp/whatsapp-api.service';


@Injectable()
export class OnboardingFlowService {
  private readonly logger = new Logger(OnboardingFlowService.name);

  constructor(
    private readonly whatsappApi: WhatsappApiService,
  ) {}

  /**
   * Load private key used for Flow decryption
   * You can also load from env instead of file if you prefer.
   */
  // private getPrivateKey(): string {
  //   // Option A: from file (recommended for docker)
  //   const keyPath =
  //     process.env.FLOW_PRIVATE_KEY_PATH ??
  //     path.join(__dirname, '..', 'keys', 'flow_private.pem');

  //   this.logger.debug(`🔑 Loading private key from: ${keyPath}`);

  //   const pem = fs.readFileSync(keyPath, 'utf8');
  //   return pem;

  //   // Option B (if you stored it in env as single-line with \n)
  //   // const envKey = process.env.FLOW_PRIVATE_KEY;
  //   // if (!envKey) throw new Error('FLOW_PRIVATE_KEY not set');
  //   // return envKey.replace(/\\n/g, '\n');
  // }

  private getPrivateKey(): string {
    // Always load from /app/dist/keys/... in production
    const basePath = path.resolve(process.cwd(), 'dist', 'keys');
    const keyPath = path.join(basePath, 'flow_private.pem');
  
    this.logger.debug(`🔑 Loading private key from: ${keyPath}`);
  
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Private key not found at: ${keyPath}`);
    } 
  
    return fs.readFileSync(keyPath, 'utf8');
  }

  /**
   * Core decryption logic – 100% equivalent of the Express sample.
   */
  private decryptPayload(body: MetaFlowEncryptedDto): any {
    const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

    this.logger.debug('Starting onboarding flow decryption...');

    const privatePem = this.getPrivateKey();

    // 1️⃣ Decrypt AES key created by Meta (RSA-OAEP + SHA256)
    const decryptedAesKey = crypto.privateDecrypt(
      {
        key: crypto.createPrivateKey(privatePem),
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encrypted_aes_key, 'base64'),
    );

    // 2️⃣ Split GCM body + tag (last 16 bytes)
    const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
    const initialVectorBuffer = Buffer.from(initial_vector, 'base64');

    const TAG_LENGTH = 16;
    const encryptedBody = flowDataBuffer.subarray(0, -TAG_LENGTH);
    const encryptedTag = flowDataBuffer.subarray(-TAG_LENGTH);

    // 3️⃣ AES-128-GCM decrypt
    const decipher = crypto.createDecipheriv(
      'aes-128-gcm',
      decryptedAesKey,
      initialVectorBuffer,
    );
    decipher.setAuthTag(encryptedTag);

    const decryptedJSONString = Buffer.concat([
      decipher.update(encryptedBody),
      decipher.final(),
    ]).toString('utf-8');

    this.logger.debug(`Decrypted Flow Body: ${decryptedJSONString}`);

    return {
      decryptedBody: JSON.parse(decryptedJSONString),
      aesKeyBuffer: decryptedAesKey,
      initialVectorBuffer,
    };
  }

  /**
   * Encrypt response to send back to Meta.
   * (Almost same as docs, with IV bit-flip).
   */
  private encryptResponse(
    response: any,
    aesKeyBuffer: Buffer,
    initialVectorBuffer: Buffer,
  ): string {
    // Flip IV bits
    const flippedIv = [];
    for (const [, byte] of initialVectorBuffer.entries()) {
      flippedIv.push(~byte);
    }

    const cipher = crypto.createCipheriv(
      'aes-128-gcm',
      aesKeyBuffer,
      Buffer.from(flippedIv),
    );

    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(response), 'utf-8'),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString('base64');

    return ciphertext;
  }

  /**
   * Entry point used by controller when Meta posts encrypted flow submission.
   *  - decrypts
   *  - persists user/identity
   *  - sends welcome message
   *  - returns base64-encoded JSON to Meta
   */
  async handleEncryptedSubmission(body: MetaFlowEncryptedDto): Promise<string> {
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } =
      this.decryptPayload(body);

    /**
     * Example request from your Identity flow:
     * {
     *   version: "3.0",
     *   action: "complete",
     *   data: {
     *     method: "bvn" | "nin",
     *     bvn_number: "...",
     *     nin_number: "...",
     *     id_dob: "1990-01-01",
     *     pin: "1234",
     *     confirm_pin: "1234",
     *     first_name: "John",
     *     last_name: "Doe",
     *     email: "test@example.com",
     *     gender: "male",
     *     phone_number: "2348...." // if you added it in flow
     *   }
     * }
     */
    const { action, data } = decryptedBody;
    console.log(JSON.stringify(decryptedBody))

    // Health check from Meta sends { action: "ping" }
    if (action === 'ping') {
      const healthResponse = { data: { status: 'active' } };
      return this.encryptResponse(healthResponse, aesKeyBuffer, initialVectorBuffer);
    }

    // Normal completion
    this.logger.log(`✅ Onboarding flow completed: ${JSON.stringify(data)}`);

    // 🧩 Determine phone: either from flow data or map from Meta webhook
    const phone = data.phone_number || data.msisdn; // adapt to your schema

    // 1️⃣ Persist user
    // await this.usersService.createOrUpdateFromFlow({
    //   phone,
    //   method: data.method,
    //   bvn: data.bvn_number,
    //   nin: data.nin_number,
    //   dob: data.id_dob,
    //   pin: data.pin,
    //   firstName: data.first_name,
    //   lastName: data.last_name,
    //   email: data.email,
    //   gender: data.gender,
    // });

    // 2️⃣ Send welcome WhatsApp message
    if (phone) {
      await this.whatsappApi.sendText(
        phone,
        `🎉 Welcome to Billy!

Your profile and security PIN are set up.

You can now:
• Buy airtime & data
• Pay bills (electricity, cable, etc.)
• Trade crypto to Naira instantly
• Ask me anything about your money 💚

Reply *menu* to see what I can do.`
      );
    }

    // 3️⃣ Response back to Meta (success)
    const responseBody = { success: true };
    return this.encryptResponse(responseBody, aesKeyBuffer, initialVectorBuffer);
  }

  /**
   * Optional helper – start the onboarding flow for a phone number.
   * Used by your message webhook when a new user chats Billy.
   */
  async startOnboardingFlow(phoneNumber: string) {
    const flowId = '834331069565896'; // Billing Onboarding Users
    const flowName = "Billing Onboarding Users";
    const flowCTA = "Begin OnBparding";
    const flowToken = process.env.FLOW_PRIVATE_KEY
    await this.whatsappApi.sendFlowMessage({
      to: phoneNumber,
      flowCTA,
      flowName,
    });
  }
}