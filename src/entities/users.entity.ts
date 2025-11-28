import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('users')
@Unique(['phoneNumber'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phone_number', length: 20 })
  phoneNumber: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ type: 'date', nullable: true })
  dob: Date | null;

  @Column({ length: 150, nullable: true })
  email: string | null;

  @Column({ length: 20, nullable: true })
  gender: string | null;

  @Column({ name: 'pin_hash', length: 255 })
  pinHash: string;

  @Column({ name: 'id_method', length: 20, nullable: true })
  idMethod: string | null; // 'bvn' | 'nin'

  @Column({ name: 'id_number', length: 50, nullable: true })
  idNumber: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}