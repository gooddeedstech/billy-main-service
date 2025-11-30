import { UserTransaction } from '@/entities/user_transactions.entity';
import { OnboardingUser } from '@/entities/users.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionType } from './enum/user.enums';


@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(UserTransaction)
    private readonly txRepo: Repository<UserTransaction>,

    @InjectRepository(OnboardingUser)
    private readonly userRepo: Repository<OnboardingUser>,
  ) {}

  /**
   * Record CR or DR transaction
   */
  async record(
    userId: string,
    type: TransactionType,
    amount: number,
    description: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tx = this.txRepo.create({
      user,
      type,
      amount,
      description,
    });

    return this.txRepo.save(tx);
  }

  /**
   * Get user's transaction history
   */
  async history(userId: string) {
    return this.txRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Sum user balance using CR - DR
   */
  async getBalance(userId: string) {
    const txs = await this.history(userId);

    let credit = 0;
    let debit = 0;

    for (const tx of txs) {
      if (tx.type === TransactionType.CREDIT) credit += Number(tx.amount);
      else debit += Number(tx.amount);
    }

    return credit - debit;
  }
}