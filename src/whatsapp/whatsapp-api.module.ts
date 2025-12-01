import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsappApiService } from './whatsapp-api.service';
import { WhatsappAPIWebhookController } from './webhook.controller';
import { WhatsappWebhookService } from './webhook.service';
import { OnboardingFlowService } from '@/flows/on-boading/onboarding-flow.service';
import { WhatsappEventFilterService } from './filters/whatsapp-event-filter.service';
import { UserService } from '@/flows/on-boading/services/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingUser } from '@/entities/users.entity';
import { UserBeneficiary } from '@/entities/user_beneficiaries.entity';
import { UserTransaction } from '@/entities/user_transactions.entity';
import { Tier } from '@/entities/tier.entity';
import { RubiesKYCService } from '@/rubies/rubie-kyc.service';
import { RubiesVirtualAccountService } from '@/rubies/rubies-virtual-account.service';

@Module({
  imports: [
    HttpModule,
  TypeOrmModule.forFeature([
        OnboardingUser,
        UserBeneficiary,
        UserTransaction,
        Tier,
      ]),],          
  providers: [WhatsappApiService,WhatsappEventFilterService,RubiesKYCService,RubiesVirtualAccountService,  UserService, WhatsappWebhookService, OnboardingFlowService],
  controllers:[WhatsappAPIWebhookController],
  exports: [WhatsappApiService],  
})
export class WhatsappApiModule {}