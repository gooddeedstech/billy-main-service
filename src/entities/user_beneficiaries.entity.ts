import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OnboardingUser } from './users.entity';
import { BeneficiaryType } from '@/flows/on-boading/services/enum/user.enums';

@Entity({ name: 'user_beneficiaries' })
export class UserBeneficiary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => OnboardingUser, (user) => user.beneficiaries, {
    onDelete: 'CASCADE',
  })
  user!: OnboardingUser;

   // The main beneficiary number (account number or phone number)
  @Column()
  name!: string;

  // The main beneficiary number (account number or phone number)
  @Column()
  number!: string;

  @Column({
    type: 'enum',
    enum: BeneficiaryType,
  })
  type!: BeneficiaryType;

  // Store other details like bankCode, bankName, accountName
  @Column({ type: 'jsonb', nullable: true })
  data?: {
    bankCode?: string;
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    [key: string]: any;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}