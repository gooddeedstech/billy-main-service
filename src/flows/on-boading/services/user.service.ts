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
import { WhatsappApiService } from '@/whatsapp/whatsapp-api.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(OnboardingUser)
    private readonly userRepo: Repository<OnboardingUser>,
     @InjectRepository(Tier)
    private readonly tierRepo: Repository<Tier>,
    private readonly rubiesKyc: RubiesKYCService,
    private readonly virtualAccountService: RubiesVirtualAccountService,
     private readonly whatsappApiService: WhatsappApiService,
  ) {}

  /**
   * Create a user OR update if phone already exists
   */
async onboardUser(phoneNumber: string, dto: OnboardingFlowDto) {
  dto.phone_number = phoneNumber;

  const {
    phone_number,
    bvn_number,
    id_dob,
    first_name,
    last_name,
    email,
    gender,
    pin,
    confirm_pin,
  } = dto;

  if (!phone_number) {
    throw new BadRequestException('Phone number is required');
  }

  if (!pin || !confirm_pin) {
    throw new BadRequestException('PIN and Confirm PIN are required');
  }

  if (pin !== confirm_pin) {
    throw new BadRequestException('PIN and Confirm PIN must match');
  }

  if (!bvn_number) {
    throw new BadRequestException('BVN is required');
  }

  if (!id_dob) {
    throw new BadRequestException('Date of birth is required');
  }

  // -------------------------------------------------------
  // 🔍 STEP 1 — Validate BVN with Rubies
  // -------------------------------------------------------
  const kycResponse = await this.rubiesKyc.validateBvn({
    bvn: bvn_number,
    dob: id_dob,
    firstName: first_name,
    lastName: last_name,
    reference: `billy-bvn-${phone_number}-${Date.now()}`,
  });

  if (!kycResponse?.data?.isValid) {
    throw new BadRequestException('BVN validation failed');
  }

  // -------------------------------------------------------
  // 👤 STEP 2 — Create or Update User
  // -------------------------------------------------------
  let user = await this.userRepo.findOne({
    where: { phoneNumber: phone_number },
    relations: ['tier'],
  });

  if (!user) {
    user = this.userRepo.create({
      phoneNumber: phone_number,
    });
  }

  // Update user fields
  Object.assign(user, {
    firstName: first_name,
    lastName: last_name,
    email,
    gender,
    dob: id_dob,
    bvn: bvn_number,
    verificationMethod: 'bvn', // Since method is fixed
  });

  // -------------------------------------------------------
  // 🔐 STEP 3 — Hash PIN
  // -------------------------------------------------------
  user.pinHash = await bcrypt.hash(pin, 10);

  // -------------------------------------------------------
  // 🏦 STEP 4 — Create Rubies Virtual Account
  // -------------------------------------------------------
  // const virtualAccount = await this.virtualAccountService.createVirtualAccount({
  //   firstName: first_name,
  //   lastName: last_name,
  //   gender,
  //   phoneNumber: phone_number,
  //   bvn: bvn_number,
  //   reference: `va-${phone_number}-${Date.now()}`,
  // });

  const virtualAccount =  {
  "data": {
    "accountNumber": "8880062492",
    "accountName": "Samuel Osaieme",
    "accountParent": "1000001179",
    "accountCustomerId": "BUS0000000056",
    "responseCode": "00",
    "responseMessage": "Completed successfully"
  }
}
  const { accountNumber, accountName, accountCustomerId } = virtualAccount?.data ?? {};

  if (!accountNumber) {
    throw new BadRequestException(
      'Rubies virtual account creation failed — missing accountNumber.'
    );
  }

  user.virtualAccount = accountNumber;
  user.virtualAccountName = accountName;
  user.accountCustomerId = accountCustomerId;

  // -------------------------------------------------------
  // 🎖 STEP 5 — Assign Tier (Default: Tier 1)
  // -------------------------------------------------------
  const tier = await this.tierRepo.findOne({
    where: { tier: TierLevel.TIER_1 },
  });

  if (!tier) {
    throw new BadRequestException('Tier 1 not found');
  }

  user.tier = tier;

  // -------------------------------------------------------
  // 💾 STEP 6 — Save User
  // -------------------------------------------------------
  const savedUser = await this.userRepo.save(user);

  // -------------------------------------------------------
  // 📤 Final Response
  // -------------------------------------------------------
   // Send confirmation message

   const va = virtualAccount?.data;
      await this.whatsappApiService.sendText(
  phoneNumber,
  `🎉 *Registration Successful, ${first_name}!* \n\n` +
  `Your Billy virtual account is now active. 🎯\n\n` +
  `🏦 *Account Details*\n` +
  `• *Account Number:* ${va.accountNumber}\n` +
  `• *Account Name:* ${va.accountName}\n` +
  `• *Bank:* Rubies MFB (Powered by Billy)\n\n` +
  `You can now receive transfers instantly. 🚀\n\n` +
  `Need anything? Just type *help* anytime!`
);

  return 'Ok'
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