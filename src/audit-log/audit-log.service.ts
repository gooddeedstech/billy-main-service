import { AuditLog } from '@/entities/audit-log.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';


@Injectable()
export class AuditLogService {
  constructor(@InjectRepository(AuditLog) private repo: Repository<AuditLog>) {}

  async write(entry: Partial<AuditLog>) {
    return this.repo.save(this.repo.create(entry));
  }

  async list(page=1, limit=20, q?: string) {
    const qb = this.repo.createQueryBuilder('a')
      .orderBy('a.dateCreated','DESC')
      .skip((page-1)*limit).take(limit);
    if (q) qb.andWhere('(a.action ILIKE :q OR a.actorId ILIKE :q)', { q:`%${q}%` });
    const [data,total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}