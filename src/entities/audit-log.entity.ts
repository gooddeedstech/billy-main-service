import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index
} from 'typeorm';

export enum ActorType {
  ADMIN = 'ADMIN',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

@Entity({ name: 'audit_logs' })
@Index('IDX_audit_actor', ['actorId', 'actorType'])
@Index('IDX_audit_action', ['action'])
@Index('IDX_audit_target', ['targetId'])
export class AuditLog {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Who performed the action */
  @Column({ type: 'varchar', length: 64 })
  actorId: string;

  @Column({
    type: 'enum',
    enum: ActorType,
    default: ActorType.SYSTEM,
  })
  actorType: ActorType;

  /** What action was performed */
  @Column({ type: 'varchar', length: 128 })
  action: string;

  /** Target of the action: TIN, BVN, account number, etc. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  targetId?: string;

  /** Additional request details (masked when sensitive) */
  @Column({ type: 'jsonb', nullable: true })
  requestPayload?: Record<string, any>;

  /** Response or result of the operation */
  @Column({ type: 'jsonb', nullable: true })
  responseData?: Record<string, any>;

  /** Channel: API, BACKOFFICE, CRON, SYSTEM */
  @Column({ type: 'varchar', length: 32, default: 'API' })
  actionSource: string;

  /** Security tracking */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent?: string;

  /** Timestamp */
  @CreateDateColumn()
  createdAt: Date;
}