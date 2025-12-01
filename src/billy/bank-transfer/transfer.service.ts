import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from '@/flows/on-boading/services/user.service';
import { RubiesService } from '@/rubies/rubies.service';

export interface ExecuteTransferPayload {
  amount: number;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
}

@Injectable()
export class TransferService {
  constructor(
    private readonly userService: UserService,
    private readonly rubies: RubiesService,
  ) {}

  async verifyPin(phone: string, pin: string): Promise<void> {
    const user = await this.userService.findByPhone(phone);
    if (!user) throw new BadRequestException('User not found');

    if (!user.pinHash) {
      throw new BadRequestException('PIN not set for this user');
    }

    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) throw new BadRequestException('Incorrect PIN');
  }

  async executeTransfer(
    phone: string,
    payload: ExecuteTransferPayload,
  ): Promise<any> {
    const user = await this.userService.findByPhone(phone);
    if (!user) throw new BadRequestException('User not found');

    if (!user.virtualAccount) {
      throw new BadRequestException(
        'User does not have a funding virtual account',
      );
    }

    // 🧮 Check wallet balance
    if ((user.balance ?? 0) < payload.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // 💸 Call Rubies transfer API
    const tx = await this.rubies.fundTransfer({
      amount: payload.amount,
      creditAccountNumber: payload.accountNumber,
      creditAccountName: payload.accountName,
      bankCode: payload.bankCode,
      bankName: payload.bankName,
      narration: `Billy Transfer from ${user.firstName} ${user.lastName}`,
      debitAccountNumber: user.virtualAccount,
      reference: `tx-${Date.now()}`,
      sessionId: `${user.phoneNumber}-${Date.now()}`,
    });

    // ✅ On success, debit wallet
    user.balance = (user.balance ?? 0) - payload.amount;
    await this.userService.update(user.id, user);

    return tx;
  }
}