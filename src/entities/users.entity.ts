import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

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
  dob?: string; // YYYY-MM-DD

  @Column({ nullable: true })
  gender?: string; 

  @Column({ nullable: true })
  verificationMethod?: string; // 'bvn' | 'nin'

  @Column({ nullable: true })
  verificationId?: string; // BVN or NIN

  @CreateDateColumn()
  createdAt!: Date;
}