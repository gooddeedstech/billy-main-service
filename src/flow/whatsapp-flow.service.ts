import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { FlowsEncryptedDto } from './dto/flows-encrypted.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@/entities/users.entity';

@Injectable()
export class WhatsappFlowService {
  private readonly logger = new Logger(WhatsappFlowService.name);
  private readonly privateKey: string;
  private readonly phoneNumberId: string;
  private readonly waToken: string;

  constructor(
    private readonly http: HttpService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    // Load RSA private key
    if (process.env.WHATSAPP_PRIVATE_KEY) {
      this.privateKey = process.env.WHATSAPP_PRIVATE_KEY.replace(/\\n/g, '\n');
    } else if (process.env.WHATSAPP_PRIVATE_KEY_PATH) {
      const p = path.resolve(process.env.WHATSAPP_PRIVATE_KEY_PATH);
      this.privateKey = fs.readFileSync(p, 'utf8');
    } else {
      throw new Error(
        'Missing WHATSAPP_PRIVATE_KEY or WHATSAPP_PRIVATE_KEY_PATH in env',
      );
    }

    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    this.waToken = process.env.WHATSAPP_API_TOKEN!;

    if (!this.phoneNumberId || !this.waToken) {
      this.logger.warn(
        'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_API_TOKEN not set – sending messages will fail.',
      );
    }
  }

  // ---------------------------------------------------------
  // 1) Serve Flow JSON
  // ---------------------------------------------------------
  getOnboardingFlow() {
    return {
      routing_model: {
        PERSONAL_INFO: ['PIN_SETUP'],
        PIN_SETUP: ['IDENTITY_CHECK'],
        IDENTITY_CHECK: [],
      },
      data_api_version: '3.0',
      version: '7.2',
      screens: [
        {
          id: 'PERSONAL_INFO',
          title: 'Personal Information',
          data: {},
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'Form',
                name: 'personal_info_form',
                children: [
                  {
                    type: 'TextSubheading',
                    text: 'Please enter your personal information',
                  },
                  {
                    type: 'TextInput',
                    label: 'First Name',
                    name: 'first_name',
                    required: true,
                  },
                  {
                    type: 'TextInput',
                    label: 'Last Name',
                    name: 'last_name',
                    required: true,
                  },
                  {
                    type: 'DatePicker',
                    label: 'Date of Birth',
                    name: 'dob',
                    required: true,
                  },
                  {
                    type: 'TextInput',
                    label: 'Email',
                    name: 'email',
                    'input-type': 'email',
                    required: true,
                  },
                  {
                    type: 'Dropdown',
                    label: 'Gender',
                    name: 'gender',
                    required: true,
                    'data-source': [
                      { id: 'male', title: 'Male' },
                      { id: 'female', title: 'Female' },
                      { id: 'other', title: 'Other' },
                    ],
                  },
                  {
                    type: 'Footer',
                    label: 'Continue',
                    'on-click-action': {
                      name: 'navigate',
                      next: { type: 'screen', name: 'PIN_SETUP' },
                      payload: {
                        first_name: '${form.first_name}',
                        last_name: '${form.last_name}',
                        dob: '${form.dob}',
                        email: '${form.email}',
                        gender: '${form.gender}',
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          id: 'PIN_SETUP',
          title: 'Create Transaction PIN',
          data: {
            first_name: { type: 'string', __example__: 'John' },
            last_name: { type: 'string', __example__: 'Doe' },
            dob: { type: 'string', __example__: '1990-01-01' },
            email: { type: 'string', __example__: 'test@example.com' },
            gender: { type: 'string', __example__: 'male' },
          },
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'Form',
                name: 'pin_form',
                children: [
                  {
                    type: 'TextSubheading',
                    text: 'Create Your Transaction PIN',
                  },
                  {
                    text: 'PIN Must be 4 Digits',
                    type: 'TextCaption',
                  },
                  {
                    type: 'TextInput',
                    label: 'Enter PIN',
                    name: 'pin',
                    'input-type': 'password',
                    required: true,
                  },
                  {
                    type: 'TextInput',
                    label: 'Confirm PIN',
                    name: 'confirm_pin',
                    'input-type': 'password',
                    required: true,
                  },
                  {
                    type: 'Footer',
                    label: 'Next',
                    'on-click-action': {
                      name: 'navigate',
                      next: { type: 'screen', name: 'IDENTITY_CHECK' },
                      payload: {
                        pin: '${form.pin}',
                        confirm_pin: '${form.confirm_pin}',
                        first_name: '${data.first_name}',
                        last_name: '${data.last_name}',
                        dob: '${data.dob}',
                        email: '${data.email}',
                        gender: '${data.gender}',
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          id: 'IDENTITY_CHECK',
          title: 'Complete Your Identity Check',
          terminal: true,
          success: true,
          data: {
            pin: { type: 'string', __example__: '1234' },
            confirm_pin: { type: 'string', __example__: '1234' },
            first_name: { type: 'string', __example__: 'John' },
            last_name: { type: 'string', __example__: 'Doe' },
            dob: { type: 'string', __example__: '1990-01-01' },
            email: { type: 'string', __example__: 'test@example.com' },
            gender: { type: 'string', __example__: 'male' },
          },
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'Form',
                name: 'identity_form',
                children: [
                  {
                    type: 'TextSubheading',
                    text: 'Choose your verification method',
                  },
                  {
                    type: 'Dropdown',
                    label: 'Verification Method',
                    name: 'method',
                    required: true,
                    'data-source': [
                      { id: 'bvn', title: 'BVN' },
                      { id: 'nin', title: 'NIN' },
                    ],
                  },
                  {
                    type: 'TextInput',
                    label: 'Enter BVN or NIN',
                    name: 'id_number',
                    required: true,
                  },
                  {
                    type: 'DatePicker',
                    label: 'Your Date of Birth',
                    name: 'id_dob',
                    required: true,
                  },
                  {
                    type: 'Footer',
                    label: 'Complete Verification',
                    'on-click-action': {
                      name: 'complete',
                      payload: {
                        method: '${form.method}',
                        id_number: '${form.id_number}',
                        id_dob: '${form.id_dob}',
                        pin: '${data.pin}',
                        confirm_pin: '${data.confirm_pin}',
                        first_name: '${data.first_name}',
                        last_name: '${data.last_name}',
                        dob: '${data.dob}',
                        email: '${data.email}',
                        gender: '${data.gender}',
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    };
  }

  // ---------------------------------------------------------
  // 2) Decrypt encrypted submission from WhatsApp
  // ---------------------------------------------------------
  private decryptPayload(body: FlowsEncryptedDto): any {
    const { encrypted_key, encrypted_data, iv, tag } = body;

    // 1. Decrypt AES symmetric key with RSA private key
    const symmetricKey = crypto.privateDecrypt(
      {
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        // oaepHash: 'sha256', // uncomment if docs say so
      },
      Buffer.from(encrypted_key, 'base64'),
    );

    // 2. Decrypt data using AES-GCM
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      symmetricKey,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    let decrypted =
      decipher.update(encrypted_data, 'base64', 'utf8') +
      decipher.final('utf8');

    this.logger.debug(`Decrypted Flow payload: ${decrypted}`);

    return JSON.parse(decrypted);
  }

  // ---------------------------------------------------------
  // 3) Onboard user (shared by encrypted/plain flows)
  // ---------------------------------------------------------
  private async onboardUserFromPayload(payload: any) {
    // expected fields from flow:
    const {
      phone, // you'll need to map WhatsApp user phone to this
      first_name,
      last_name,
      dob,
      email,
      gender,
      pin,
      confirm_pin,
      method,
      id_number,
      id_dob,
    } = payload;

    if (!phone) {
      throw new Error('Missing phone in payload – map WA sender msisdn to this.');
    }

    if (pin !== confirm_pin) {
      return {
        success: false,
        error_message: 'PIN and Confirm PIN do not match',
      };
    }

    // Hash PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Normalize phone here if needed
    const normalizedPhone = phone.toString().replace(/\s+/g, '');

    // Upsert user
    let user = await this.userRepo.findOne({ where: { phoneNumber: normalizedPhone } });

    if (!user) {
      user = this.userRepo.create({
        phoneNumber: normalizedPhone,
        firstName: first_name,
        lastName: last_name,
        dob: dob ? new Date(dob) : null,
        email: email ?? null,
        gender: gender ?? null,
        pinHash,
        idMethod: method ?? null,
        idNumber: id_number ?? null,
      });
    } else {
      user.firstName = first_name;
      user.lastName = last_name;
      user.dob = dob ? new Date(dob) : null;
      user.email = email ?? null;
      user.gender = gender ?? null;
      user.pinHash = pinHash;
      user.idMethod = method ?? null;
      user.idNumber = id_number ?? null;
    }

    const saved = await this.userRepo.save(user);

    // Send welcome message (async, don't block)
    this.sendWelcomeMessage(normalizedPhone, saved.firstName).catch((err) =>
      this.logger.error('Failed to send welcome WA message', err),
    );

    return {
      success: true,
      user_id: saved.id,
    };
  }

  // ---------------------------------------------------------
  // 4) Public methods used by controller
  // ---------------------------------------------------------
  async processEncryptedSubmission(body: FlowsEncryptedDto) {
    const decrypted = this.decryptPayload(body);

    const result = await this.onboardUserFromPayload(decrypted);

    if (!result.success) {
      return {
        success: false,
        error_message: result.error_message,
      };
    }

    // WhatsApp Flows expects a JSON structure; you can shape this as needed
    return {
      success: true,
      data: {
        onboarding_status: 'COMPLETED',
        user_id: result.user_id,
      },
    };
  }

  // for local dev testing, no encryption
  async processPlainSubmission(decryptedBody: any) {
    const result = await this.onboardUserFromPayload(decryptedBody);

    return {
      success: result.success,
      data: result.success
        ? {
            onboarding_status: 'COMPLETED',
            user_id: result.user_id,
          }
        : {
            onboarding_status: 'FAILED',
            error_message: result.error_message,
          },
    };
  }

  // ---------------------------------------------------------
  // 5) Send WhatsApp welcome message
  // ---------------------------------------------------------
  private async sendWelcomeMessage(msisdn: string, firstName: string) {
    if (!this.phoneNumberId || !this.waToken) {
      this.logger.warn(
        'Skipping WA welcome message – phoneNumberId or waToken missing',
      );
      return;
    }

    const url = `https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: msisdn,
      type: 'text',
      text: {
        body: `Hi ${firstName}, your Billy account is set up ✅.\n\nYou can now buy airtime, data, pay bills and more directly from this chat. Just say "menu" to get started.`,
      },
    };

    this.logger.log(`Sending WA welcome message to ${msisdn}`);

    await firstValueFrom(
      this.http.post(url, body, {
        headers: {
          Authorization: `Bearer ${this.waToken}`,
          'Content-Type': 'application/json',
        },
      }),
    );
  }
}