import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcryptjs';
import { OnboardingUser } from '@/entities/users.entity';
import { TierLevel } from './enum/user.enums';
import { RubiesKYCService } from '@/rubies/rubie-kyc.service';
import { OnboardingFlowDto } from '../dtos/on-boarding.dto';
import { RubiesVirtualAccountService } from '@/rubies/rubies-virtual-account.service';
import { Tier } from '@/entities/tier.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(OnboardingUser)
    private readonly userRepo: Repository<OnboardingUser>,
     @InjectRepository(Tier)
    private readonly tierRepo: Repository<Tier>,
    private readonly rubiesKyc: RubiesKYCService,
    private readonly virtualAccountService: RubiesVirtualAccountService,
  ) {}

  /**
   * Create a user OR update if phone already exists
   */
async onboardUser(dto: OnboardingFlowDto) {
  const {
    phone_number,
    method,
    bvn_number,
    nin_number,
    id_dob,
    first_name,
    last_name,
    email,
    gender,
    pin,
    confirm_pin,
  } = dto;

  if (!phone_number) throw new BadRequestException('Phone number is required');
  if (!['bvn', 'nin'].includes(method))
    throw new BadRequestException('Method must be bvn or nin');
  if (pin !== confirm_pin)
    throw new BadRequestException('PIN and Confirm PIN must match');

  let kycResponse;

  // -------------------------------------------------------
  // 🔍 STEP 1 — Validate BVN / NIN
  // -------------------------------------------------------
  if (method === 'bvn') {
    if (!bvn_number)
      throw new BadRequestException('BVN is required for BVN verification');

    kycResponse = await this.rubiesKyc.validateBvn({
      bvn: bvn_number,
      dob: id_dob,
      firstName: first_name,
      lastName: last_name,
      reference: `billy-bvn-${phone_number}-${Date.now()}`,
    });

    if (!kycResponse.data.isValid)
      throw new BadRequestException('BVN validation failed');
  }

  if (method === 'nin') {
    if (!nin_number)
      throw new BadRequestException('NIN is required for NIN verification');

    kycResponse = await this.rubiesKyc.validateNin({
      idNumber: nin_number,
      dob: id_dob,
      firstName: first_name,
      lastName: last_name,
      reference: `billy-nin-${phone_number}-${Date.now()}`,
    });

    if (!kycResponse.data.isValid)
      throw new BadRequestException('NIN validation failed');
  }

  // -------------------------------------------------------
  // 🧍 STEP 2 — Create / Update User
  // -------------------------------------------------------
  let user = await this.userRepo.findOne({
    where: { phoneNumber: phone_number },
    relations: ['tier'], // ensure tier loads
  });

  if (!user) {
    user = this.userRepo.create({
      phoneNumber: phone_number,
      firstName: first_name,
      lastName: last_name,
      email,
      dob: id_dob,
      gender,
      verificationMethod: method,
    });
  } else {
    Object.assign(user, {
      firstName: first_name,
      lastName: last_name,
      email,
      dob: id_dob,
      gender,
      verificationMethod: method,
    });
  }

  // -------------------------------------------------------
  // 🔐 STEP 3 — Hash PIN
  // -------------------------------------------------------
  user.pinHash = await bcrypt.hash(pin, 10);

  // -------------------------------------------------------
  // 🏦 STEP 4 — Create Rubies Virtual Account
  // -------------------------------------------------------
  const virtualAccount = await this.virtualAccountService.createVirtualAccount({
    firstName: first_name,
    lastName: last_name,
    gender,
    phoneNumber: phone_number,
    bvn: method === 'bvn' ? bvn_number : undefined,
    nin: method === 'nin' ? nin_number : undefined,
    reference: `va-${phone_number}-${Date.now()}`,
  });

  const { accountNumber, accountName, accountCustomerId } =
    virtualAccount?.data || {};

  if (!accountNumber) {
    throw new BadRequestException(
      'Rubies virtual account creation failed — no accountNumber returned.',
    );
  }

  user.virtualAccount = accountNumber;
  user.virtualAccountName = accountName;
  user.accountCustomerId = accountCustomerId;

  // -------------------------------------------------------
  // 🎖 STEP 5 — Assign Tier Level (Default: Tier 1)
  // -------------------------------------------------------
  const tier = await this.tierRepo.findOne({
    where: { tier: TierLevel.TIER_1 },
  });

  if (!tier) throw new BadRequestException('Tier 1 not found in system');

  user.tier = tier; // <--- LINK TIER TO USER

  // -------------------------------------------------------
  // 💾 STEP 6 — Save User
  // -------------------------------------------------------
  const savedUser = await this.userRepo.save(user);

  return {
    success: true,
    message: 'User onboarding completed successfully',
    user: savedUser,
    virtualAccount,
    kycDetails: kycResponse,
  };
}


  /**
   * Validate PIN input against stored PIN hash
   */
  async validatePin(userId: string, pin: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.pinHash) return false;

    return bcrypt.compare(pin, user.pinHash);
  }



  async findByPhone(phone: string) {
    return this.userRepo.findOne({ where: { phoneNumber: phone } });
  }

  async findById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }
}