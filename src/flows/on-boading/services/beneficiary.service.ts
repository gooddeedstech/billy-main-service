import { UserBeneficiary } from '@/entities/user_beneficiaries.entity';
import { OnboardingUser } from '@/entities/users.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BeneficiaryType } from './enum/user.enums';


@Injectable()
export class BeneficiaryService {
  constructor(
    @InjectRepository(UserBeneficiary)
    private readonly benRepo: Repository<UserBeneficiary>,

    @InjectRepository(OnboardingUser)
    private readonly userRepo: Repository<OnboardingUser>,
  ) {}

  /**
   * Add beneficiary
   */
  async add(userId: string, number: string, type: BeneficiaryType, data?: any) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const beneficiary = this.benRepo.create({
      user,
      number,
      type,
      data,
    });

    return this.benRepo.save(beneficiary);
  }

  /**
   * List user beneficiaries
   */
  async list(userId: string) {
    return this.benRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete beneficiary
   */
  async remove(beneficiaryId: string) {
    const ben = await this.benRepo.findOne({ where: { id: beneficiaryId } });
    if (!ben) throw new NotFoundException('Beneficiary not found');

    await this.benRepo.delete(ben.id);
    return true;
  }

  /**
   * Update beneficiary metadata (e.g. bank name)
   */
  async update(beneficiaryId: string, data: any) {
    const ben = await this.benRepo.findOne({ where: { id: beneficiaryId } });
    if (!ben) throw new NotFoundException('Beneficiary not found');

    ben.data = { ...ben.data, ...data };
    return this.benRepo.save(ben);
  }
}