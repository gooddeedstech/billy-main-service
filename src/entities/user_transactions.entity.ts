import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { OnboardingUser } from './users.entity';
import { TransactionType } from '@/flows/on-boading/services/enum/user.enums';


@Entity({ name: 'user_transactions' })
export class UserTransaction {
  @PrimaryGeneratedColumn('uuid') 
  id!: string;

  @ManyToOne(() => OnboardingUser, (u) => u.transactions, {
    onDelete: 'CASCADE',
  })
  user!: OnboardingUser;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type!: TransactionType;

  @Column()
  description!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}