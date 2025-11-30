import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { UserBeneficiary } from './user_beneficiaries.entity';
import { UserTransaction } from './user_transactions.entity';
import { Tier } from './tier.entity';

@Entity({ name: 'onboarding_users' })
export class OnboardingUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ type: 'date', nullable: true })
  dob?: string;

  @Column({ nullable: true })
  gender?: string;

  @Column({ nullable: true })
  verificationMethod?: string;

  /** 🏦 RUBIES Virtual Account Number */
  @Column({ nullable: true })
  virtualAccount?: string;

  /** 🏦 Name returned from Rubies virtual account creation */
  @Column({ nullable: true })
  virtualAccountName?: string;

  /** 🏦 Customer ID returned from Rubies (BUS00000...) */
  @Column({ nullable: true })
  accountCustomerId?: string;

  /** 🔐 Hashed PIN */
  @Column({ name: 'pin_hash', nullable: true })
  pinHash?: string;

  /** ➕ Beneficiaries */
  @OneToMany(() => UserBeneficiary, (b) => b.user)
  beneficiaries!: UserBeneficiary[];

  /** 💰 Transactions */
  @OneToMany(() => UserTransaction, (t) => t.user)
  transactions!: UserTransaction[];

  @ManyToOne(() => Tier, (tier) => tier.users, { nullable: true })
  tier?: Tier; 

  @CreateDateColumn()
  createdAt!: Date;
}