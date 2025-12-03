import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { RubiesCreateVirtualAccountDto } from './dto/create-virtual-account.dto';

@Injectable()
export class RubiesVirtualAccountService {
  private readonly logger = new Logger(RubiesVirtualAccountService.name);

  private readonly baseUrl = `${process.env.RUBIES_BASE_URL}/baas-virtual-account`;
  private readonly apiKey = process.env.RUBIES_SECRET_KEY!;

  constructor(private readonly http: HttpService) {}

  /** ============================
   *  COMMON HEADERS
   * ============================ */
  private get headers() {
    return {
      'Content-Type': 'application/json',
      Accept: '*/*',
      Authorization: this.apiKey,
    };
  }

  /** ============================
   *  UNIVERSAL POST WRAPPER
   * ============================ */
  private async post(endpoint: string, payload: any) {
    const url = `${this.baseUrl}/${endpoint}`;

    this.logger.log(`📡 Rubies POST → ${url}`);

    try {
      const res = await firstValueFrom(
        this.http.post(url, payload, { headers: this.headers }),
      );

      return res.data;

    } catch (error: any) {
      const errData = error.response?.data || error.message;

      this.logger.error(
        `❌ Rubies API Error (${endpoint}) → ${JSON.stringify(errData)}`,
      );

      throw new BadRequestException({
        success: false,
        message:
          errData?.responseMessage ||
          errData?.message ||
          'Rubies request failed',
        raw: errData,
      });
    }
  }

  /** ============================================
   *  🟩 CREATE VIRTUAL ACCOUNT (BVN OR NIN)
   * ============================================ */
  async createVirtualAccount(dto: RubiesCreateVirtualAccountDto) {
    const { bvn, nin } = dto;

    // Ensure at least ONE ID is supplied
    if (!bvn && !nin) {
      throw new BadRequestException(
        'Either BVN or NIN must be provided to create a virtual account.',
      );
    }

    const payload: any = {
      accountAmountControl: "VARIABLE",
      accountParent: process.env.RUBIES_PARENT_ACCOUNT,
      amount: 1,
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender,
      phoneNumber: dto.phoneNumber,
      reference: dto.reference,
    };

    // Dynamically include only one
    if (bvn) payload.bvn = bvn;
    if (nin) payload.nin = nin;

    this.logger.log(`🧾 Creating Rubies Virtual Account → ${dto.reference}`);

    const response = await this.post('initiate-create-virtual-account', payload);

    return {
      success: true,
      message: response.responseMessage || 'Virtual account created successfully',
      data: response,
    };
  }
}