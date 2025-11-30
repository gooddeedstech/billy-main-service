import { Module } from '@nestjs/common';
import { OnboardingFlowService } from './onboarding-flow.service';
import { WhatsappApiModule } from '@/whatsapp/whatsapp-api.module';
import { OnboardingFlowController } from './onboarding-flow.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingUser } from '@/entities/users.entity';
import { UserBeneficiary } from '@/entities/user_beneficiaries.entity';
import { UserTransaction } from '@/entities/user_transactions.entity';
import { UserService } from './services/user.service';
import { BeneficiaryService } from './services/beneficiary.service';
import { TransactionService } from './services/transaction.service';
import { RubiesKYCService } from '@/rubies/rubie-kyc.service';
import { HttpModule } from '@nestjs/axios';
import { RubiesVirtualAccountService } from '@/rubies/rubies-virtual-account.service';
import { Tier } from '@/entities/tier.entity';



@Module({
  imports: [
     HttpModule,
     TypeOrmModule.forFeature([
      OnboardingUser,
      UserBeneficiary,
      UserTransaction,
      Tier,
    ]),
    WhatsappApiModule,   
  ],
  providers: [OnboardingFlowService, 
    UserService,
    BeneficiaryService,
    TransactionService, 
    RubiesKYCService,
    RubiesVirtualAccountService
  ],
  controllers: [OnboardingFlowController],
  exports: [OnboardingFlowService,UserService,
    BeneficiaryService,
    TransactionService,],
})
export class OnboardingFlowModule {} 

