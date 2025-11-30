import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  RubiesBvnValidationDto,
  RubiesNinValidationDto,
} from './dto/rubie-kyc.dto';

@Injectable()
export class RubiesKYCService {
  private readonly logger = new Logger(RubiesKYCService.name);

  private readonly baseUrl = `${process.env.RUBIES_BASE_URL}/baas-kyc`;
  private readonly apiKey = process.env.RUBIES_SECRET_KEY!;

  constructor(private readonly http: HttpService) {}

  // -------------------------------------------------------------
  // 🔐 Shared Headers for Rubies Endpoints
  // -------------------------------------------------------------
  private get headers() {
    return {
      'Content-Type': 'application/json',
      Accept: '*/*',
      Authorization: this.apiKey, // Required: SK_xxxxx
    };
  }

  // -------------------------------------------------------------
  // 📡 Shared POST Handler with Solid Error Normalization
  // -------------------------------------------------------------
  private async postToRubies(endpoint: string, payload: any) {
    const url = `${this.baseUrl}/${endpoint}`;
    this.logger.log(`📡 Rubies → POST ${url}`);
    this.logger.debug(`📤 Payload: ${JSON.stringify(payload)}`);

    try {
      const response = await firstValueFrom(
        this.http.post(url, payload, { headers: this.headers }),
      );
      this.logger.debug(`📥 Raw Response: ${JSON.stringify(response.data)}`);

      return response.data;
    } catch (error: any) {
      const e = error?.response?.data || error?.message || error;

      this.logger.error(`❌ Rubies API Error: ${JSON.stringify(e)}`);

      throw new BadRequestException({
        success: false,
        message:
          e?.responseMessage ||
          e?.message ||
          'Rubies service temporarily unavailable',
        raw: e,
      });
    }
  }

  // -------------------------------------------------------------
  // 🟦 BVN VALIDATION
  // -------------------------------------------------------------
  async validateBvn(dto: RubiesBvnValidationDto) {
    this.logger.log(`🔎 Validating BVN: ${dto.bvn}`);

    const data = await this.postToRubies('bvn-validation', dto);

    const isValid = data?.responseCode === '00';

    return {
      success: true,
      status: isValid ? 'verified' : 'failed',
      method: 'bvn',
      message: data?.responseMessage || 'BVN verification completed',
      data: {
        value: dto.bvn,
        isValid,
        details: data?.data || null,
        raw: data,
      },
    };
  }

  // -------------------------------------------------------------
  // 🟩 NIN VALIDATION
  // -------------------------------------------------------------
  async validateNin(dto: RubiesNinValidationDto) {
    this.logger.log(`🔎 Validating NIN: ${dto.idNumber}`);

    const payload = {
      dob: dto.dob,
      firstName: dto.firstName,
      lastName: dto.lastName,
      idNumber: dto.idNumber,
      reference: dto.reference,
    };

    const data = await this.postToRubies('nin-validation', payload);

    const isValid = data?.responseCode === '00';

    return {
      success: true,
      status: isValid ? 'verified' : 'failed',
      method: 'nin',
      message: data?.responseMessage || 'NIN verification completed',
      data: {
        value: dto.idNumber,
        isValid,
        details: data?.data || null,
        raw: data,
      },
    };
  }

  // -------------------------------------------------------------
  // 🔄 AUTO ROUTER FOR KYC INPUT
  // -------------------------------------------------------------
  async validateIdentity(input: {
    method: 'bvn' | 'nin';
    bvn?: string;
    nin?: string;
    dob?: string;
    firstName?: string;
    lastName?: string;
    reference?: string;
  }) {
    if (input.method === 'bvn') {
      if (!input.bvn) throw new BadRequestException('BVN is required');
      return this.validateBvn({
        bvn: input.bvn,
        dob: input.dob!,
        firstName: input.firstName!,
        lastName: input.lastName!,
        reference: input.reference!,
      });
    }

    if (!input.nin) throw new BadRequestException('NIN is required');

    return this.validateNin({
      idNumber: input.nin,
      dob: input.dob!,
      firstName: input.firstName!,
      lastName: input.lastName!,
      reference: input.reference!,
    });
  }
}