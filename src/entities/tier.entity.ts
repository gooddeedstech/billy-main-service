import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OnboardingUser } from './users.entity';
import { TierLevel } from '@/flows/on-boading/services/enum/user.enums';


@Entity({ name: 'tiers' })
export class Tier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: TierLevel,
    unique: true,
  })
  tier!: TierLevel;

  @Column({ type: 'numeric', default: 0 })
  perTransactionLimit!: number;

  @Column({ type: 'numeric', default: 0 })
  dailyLimit!: number;

  /** 👥 Many Users → One Tier */
  @OneToMany(() => OnboardingUser, (user) => user.tier)
  users!: OnboardingUser[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}