import { Injectable, Logger } from '@nestjs/common';
import { FlowsEncryptedDto } from './dto/flows-encrypted.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { OnboardingUser } from '@/entities/users.entity';

interface DecryptedResult {
  symmetricKey: Buffer;
  data: any;
  metadata?: any;
}

@Injectable()
export class WhatsappFlowService {
  private readonly logger = new Logger(WhatsappFlowService.name);
  private readonly privateKey: string;

  constructor(
    @InjectRepository(OnboardingUser)
    private readonly onboardingRepo: Repository<OnboardingUser>,
  ) {
    // Make sure \n inside .env are converted to real newlines
    const keyFromEnv = process.env.FLOW_PRIVATE_KEY;
    if (!keyFromEnv) {
      throw new Error('FLOW_PRIVATE_KEY is not set');
    }
    this.privateKey = keyFromEnv.replace(/\\n/g, '\n');
  }

  /**
   * Decrypts the flow submission payload from WhatsApp using:
   *  1. RSA (private key) -> decrypts symmetric AES key
   *  2. AES-256-GCM      -> decrypts encrypted_data
   */
  private decryptPayload(body: FlowsEncryptedDto): DecryptedResult {
    const {
      encrypted_key,
      encrypted_data,
      iv,
      tag,
      encrypted_metadata,
    } = body;

    // 1. Decrypt the symmetric key with RSA private key
    const symmetricKey = crypto.privateDecrypt(
      {
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(encrypted_key, 'base64'),
    );

    // 2. Decrypt the data with AES-256-GCM
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      symmetricKey,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    let decrypted = decipher.update(encrypted_data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    const data = JSON.parse(decrypted);
    this.logger.debug(`Decrypted flow data: ${JSON.stringify(data)}`);

    // Optional: decrypt metadata if you decide to use it later
    let metadata: any | undefined;
    if (encrypted_metadata) {
      try {
        const metaDecipher = crypto.createDecipheriv(
          'aes-256-gcm',
          symmetricKey,
          Buffer.from(iv, 'base64'),
        );
        metaDecipher.setAuthTag(Buffer.from(tag, 'base64'));

        let decryptedMeta = metaDecipher.update(
          encrypted_metadata,
          'base64',
          'utf8',
        );
        decryptedMeta += metaDecipher.final('utf8');
        metadata = JSON.parse(decryptedMeta);
      } catch (err) {
        this.logger.warn(`Could not decrypt metadata: ${err}`);
      }
    }

    return { symmetricKey, data, metadata };
  }

  /**
   * Encrypts a JSON payload for WhatsApp using AES-256-GCM and
   * Base64-encodes the final JSON { encrypted_data, iv, tag }.
   *
   * According to the Flows encryption spec, we reuse the same
   * symmetricKey that we just decrypted from the incoming payload.
   */
  private encryptResponse(
    payload: any,
    symmetricKey: Buffer,
  ): string {
    const json = JSON.stringify(payload);
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM

    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      symmetricKey,
      iv,
    );

    let encrypted = cipher.update(json, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag().toString('base64');

    const responseJson = JSON.stringify({
      encrypted_data: encrypted,
      iv: iv.toString('base64'),
      tag,
    });

    // WhatsApp expects a Base64 string of this JSON
    return Buffer.from(responseJson).toString('base64');
  }

  /**
   * Main entry point used by the controller.
   *  - Decrypts incoming payload
   *  - Persists new onboarding user
   *  - Returns encrypted_response Base64 string
   */
  async processEncryptedSubmission(
    body: FlowsEncryptedDto,
  ): Promise<string> {
    const { symmetricKey, data } = this.decryptPayload(body);

    // Shape of `data` depends on your flow.
    // With your flow JSON, the final submission will typically
    // include something like:
    // {
    //   pin: '1234',
    //   confirm_pin: '1234',
    //   method: 'bvn' | 'nin',
    //   id_number: '...',
    //   id_dob: '1990-01-01',
    //   first_name: 'John',
    //   last_name: 'Doe',
    //   dob: '1990-01-01',
    //   email: 'test@example.com',
    //   gender: 'male'
    //   ...
    // }

    const {
      first_name,
      last_name,
      dob,
      email,
      gender,
      method,
      id_number,
      id_dob,
      phone_number,
    } = data;

    const user = this.onboardingRepo.create({
      firstName: first_name,
      lastName: last_name,
      dob: id_dob || dob,
      email,
      gender,
      verificationMethod: method,
      verificationId: id_number,
      phoneNumber: phone_number,
    });

    await this.onboardingRepo.save(user);

    // Build business-level response (what YOUR system means)
    const businessResponse = {
      success: true,
      userId: user.id,
    };

    // Encrypt it for WhatsApp
    const encryptedResponse = this.encryptResponse(
      businessResponse,
      symmetricKey,
    );

    return encryptedResponse;
  }
}