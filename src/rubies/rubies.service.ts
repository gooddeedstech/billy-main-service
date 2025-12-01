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
    const axiosResponse = await firstValueFrom(
      this.http.post(url, payload, { headers: this.headers })
    );

    // Axios returns: { status, data, headers, ... }
    const data = axiosResponse.data;

    // Ensure consistent returned structure
    return {
      success: true,
      responseCode: data?.responseCode ?? null,
      responseMessage: data?.responseMessage ?? null,
      data,
    };
  }

  catch (error: any) {
    const rawResponse = error?.response?.data || null;
    const status = error?.response?.status || 500;

    this.logger.error(`❌ Rubies API Error @ ${endpoint}`);

    // Avoid circular JSON crash by serializing manually
    this.logger.error('Object:', JSON.stringify({
      status,
      message: rawResponse?.responseMessage || rawResponse?.message || 'Rubies error',
      raw: rawResponse,
    }, null, 2));

    // Known Rubies failure (4xx)
    if (status < 500) {
      throw new BadRequestException({
        success: false,
        status,
        message: rawResponse?.responseMessage 
              || rawResponse?.message 
              || 'Rubies request failed',
        raw: rawResponse,
      });
    }

    // Server or network crash
    throw new InternalServerErrorException({
      success: false,
      status,
      message: 'Rubies service unavailable',
      raw: rawResponse,
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
  async nameEnquiry(bankCode: string, accountNumber: string) {
  const payload = {
    bankCode,
    accountNumber,
  };
  console.log(payload)

  const res = await this.post("name-enquiry", payload);


  // If the API returns the data inside `.data`, unwrap it
  const data = res?.data ?? res;

  return {
    responseCode: data?.responseCode,
    responseMessage: data?.responseMessage,
    accountName: data?.accountName,
    accountNumber: data?.accountNumber,
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
      message: 'Transfer initiated',
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
      message:  'Transfer status retrieved',
      data,
    };
  }
}