import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from '@/flows/on-boading/services/user.service';
import { RubiesService } from '@/rubies/rubies.service';
import { CacheService } from '@/cache/cache.service';
import { BeneficiaryType } from '@/flows/on-boading/services/enum/user.enums';

export interface ExecuteTransferPayload {
  amount: number;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
}

// Match your RubiesTransferDto
export interface RubiesTransferDto {
  amount: number;
  creditAccountNumber: string;
  creditAccountName: string;
  bankCode: string;
  bankName: string;
  narration: string;
  debitAccountNumber: string;
  reference: string;
  sessionId: string;
}

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);
  constructor(
    private readonly userService: UserService,
    private readonly rubies: RubiesService,
    private readonly cache: CacheService,
  ) {}

  // ---------------- PIN & BALANCE ----------------

  async verifyPin(phone: string, pin: string) {
    const user = await this.userService.findByPhone(phone);
    if (!user) throw new BadRequestException('User not found');

    if (!user.pinHash) {
      throw new BadRequestException('PIN not set for this user');
    }

    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) throw new BadRequestException('Incorrect PIN');

    return user;
  }

  private ensureSufficientBalance(user: any, amount: number) {
    if (user.balance == null || Number(user.balance) < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }
  }

  // ---------------- EXECUTE TRANSFER ----------------

  async executeTransfer(
    phone: string,
    payload: ExecuteTransferPayload,
  ): Promise<any> {
    const user = await this.userService.findByPhone(phone);
     this.logger.log(`🔥 PIN STEP  ${JSON.stringify(user)} `);
    if (!user) throw new BadRequestException('User not found');

    if (!user.virtualAccount) {
      throw new BadRequestException(
        'No virtual account linked to this user. Please contact support.',
      );
    }

    this.ensureSufficientBalance(user, payload.amount);

    const request: RubiesTransferDto = {
      amount: payload.amount,
      creditAccountNumber: payload.accountNumber,
      creditAccountName: payload.accountName,
      bankCode: payload.bankCode,
      bankName: payload.bankName,
      narration: `Billy Transfer From: ${user.firstName} ${user.lastName}`,
      debitAccountNumber: user.virtualAccount,
      reference: `billy-tx-${Date.now()}`,
      sessionId: `${user.phoneNumber}-${Date.now()}`,
    };

    const tx = await this.rubies.fundTransfer(request);

    // Update wallet balance locally
    user.balance = Number(user.balance || 0) - payload.amount;
    await this.userService.update(user.id, user);

    return tx;
  }

  // ---------------- BENEFICIARY ----------------

  async saveBeneficiaryFromSession(
    phone: string,
    data: ExecuteTransferPayload,
  ) {
    const user = await this.userService.findByPhone(phone);
    if (!user) throw new BadRequestException('User not found');

    await this.userService.saveBeneficiary(user.phoneNumber, {
      type: BeneficiaryType.BANK,
      accountNumber: data.accountNumber,
      bankCode: data.bankCode,
      bankName: data.bankName,
      accountName: data.accountName,
    });
  }
}