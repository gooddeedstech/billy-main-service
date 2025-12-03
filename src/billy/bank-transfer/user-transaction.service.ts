import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionType } from '@/flows/on-boading/services/enum/user.enums';
import { UserService } from '@/flows/on-boading/services/user.service';
import { UserTransaction } from '@/entities/user_transactions.entity';

@Injectable()
export class UserTransactionService {
  constructor(
    @InjectRepository(UserTransaction)
    private readonly transactionRepo: Repository<UserTransaction>,

    private readonly userService: UserService,
  ) {}

  /**
   * 🧾 Record a debit (DR) or credit (CR) transaction
   */
  async record(
    phone: string,
    type: TransactionType,
    amount: number,
    description: string,
    reference: string,
  ): Promise<UserTransaction> {
    const user = await this.userService.findByPhone(phone);
    if (!user) throw new NotFoundException('User not found');

    const transaction = this.transactionRepo.create({
      user,
      type,
      amount,
      description,
      reference
    });

    return await this.transactionRepo.save(transaction);
  }

async getHistory(
  phone: string,
  options?: {
    page?: number;
    limit?: number;
    startDate?: string | Date;
    endDate?: string | Date;
    type?: TransactionType; // optional: DR or CR
  },
) {
  const user = await this.userService.findByPhone(phone);
  if (!user) throw new NotFoundException('User not found');

  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const startDate = options?.startDate
    ? new Date(options.startDate)
    : null;

  const endDate = options?.endDate
    ? new Date(options.endDate)
    : null;

  const type = options?.type ?? null;

  const qb = this.transactionRepo
    .createQueryBuilder('tx')
    .where('tx.userId = :userId', { userId: user.id });

  // -----------------------------
  // 🔎 DATE RANGE FILTER
  // -----------------------------
  if (startDate) qb.andWhere('tx.createdAt >= :start', { start: startDate });
  if (endDate) qb.andWhere('tx.createdAt <= :end', { end: endDate });

  // -----------------------------
  // 🔎 TYPE FILTER (DR or CR)
  // -----------------------------
  if (type) qb.andWhere('tx.type = :type', { type });

  // -----------------------------
  // 📑 PAGINATION
  // -----------------------------
  const [items, total] = await qb
    .orderBy('tx.createdAt', 'DESC')
    .skip(skip)
    .take(limit)
    .getManyAndCount();

  return {
    success: true,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    items,
  };
}

async findByReference(reference: string) {
  return this.transactionRepo.findOne({ where: { reference } });
}
}