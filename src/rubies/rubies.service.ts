import { 
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger 
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { RubiesTransferDto } from './dto/rubies-transfer.dto';

@Injectable()
export class RubiesService {
  private readonly logger = new Logger(RubiesService.name);

  private readonly baseUrl = `${process.env.RUBIES_BASE_URL}/baas-transaction`;
  private readonly apiKey = process.env.RUBIES_SECRET_KEY!;

  constructor(private readonly http: HttpService) {}

  /** -----------------------------------------------------
   * 🧩 Shared Request Headers
   * ----------------------------------------------------- */
  private get headers() {
    return {
      'Content-Type': 'application/json',
      Accept: '*/*',
      Authorization: this.apiKey,
    };
  }

  /** -----------------------------------------------------
   * 🧰 Universal POST Handler (DRY)
   * ----------------------------------------------------- */
  private async post(endpoint: string, payload: any) {
    const url = `${this.baseUrl}/${endpoint}`;

    this.logger.log(`📡 Rubies POST → ${url}`);

    try {
      const response = await firstValueFrom(
        this.http.post(url, payload, { headers: this.headers }),
      );

      return response.data;

    } catch (error: any) {
      const errData = error.response?.data;
      const status = error.response?.status ?? 500;

      this.logger.error(
        `❌ Rubies API Error @ ${endpoint} → ${JSON.stringify(errData)}`
      );

      if (status < 500) {
        throw new BadRequestException({
          success: false,
          message: errData?.responseMessage || errData?.message || 'Rubies request failed',
          raw: errData,
        });
      }

      throw new InternalServerErrorException({
        success: false,
        message: 'Rubies service unavailable',
        raw: errData,
      });
    }
  }

  /** -----------------------------------------------------
   * 🏦 1. Get All Banks
   * ----------------------------------------------------- */
  async getBanks() {
    this.logger.log('🏦 Fetching bank list from Rubies...');

    const payload = { readAll: 'YES' };

    const data = await this.post('bank-list', payload);

    return {
      success: true,
      message: 'Banks retrieved successfully',
      data,
    };
  }

  /** -----------------------------------------------------
   * 🔍 2. Name Enquiry
   * ----------------------------------------------------- */
  async nameEnquiry(accountBankCode: string, accountNumber: string) {
    const payload = { accountBankCode, accountNumber };

    this.logger.log(
      `🔍 Performing name enquiry → ${accountBankCode} / ${accountNumber}`
    );

    const data = await this.post('name-enquiry', payload);

    return {
      success: true,
      message: 'Name enquiry completed',
      data,
    };
  }

  /** -----------------------------------------------------
   * 💸 3. Fund Transfer
   * ----------------------------------------------------- */
  async fundTransfer(dto: RubiesTransferDto) {
    this.logger.log(`💸 Rubies fund transfer initiated: ${dto.reference}`);

    const data = await this.post('fund-transfer', dto);

    return {
      success: true,
      message: data?.responseMessage || 'Transfer initiated',
      data,
    };
  }

  /** -----------------------------------------------------
   * 🔁 4. Confirm Transfer (TSQ)
   * ----------------------------------------------------- */
  async confirmTransfer(reference: string) {
    this.logger.log(`🔁 Checking transfer status for → ${reference}`);

    const payload = { reference };

    const data = await this.post('tsq', payload);

    return {
      success: true,
      message: data?.responseMessage || 'Transfer status retrieved',
      data,
    };
  }
}