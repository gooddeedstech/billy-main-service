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

  @Column()
  number!: string;

  @Column({
    type: 'enum',
    enum: BeneficiaryType,
  })
  type!: BeneficiaryType;

  @Column({ type: 'jsonb', nullable: true })
  data?: any;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}