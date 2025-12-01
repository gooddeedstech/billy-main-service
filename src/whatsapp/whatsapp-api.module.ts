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
import { TransferService } from '@/billy/bank-transfer/transfer.service';
import { TransferParserService } from '@/billy/bank-transfer/transfer-parser.service';
import { BankResolverService } from '@/billy/bank-transfer/bank-resolver.service';
import { RubiesService } from '@/rubies/rubies.service';
import { CacheService } from '@/cache/cache.service';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { VasService } from '@/billy/vas.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: () => ({
        store: redisStore as any,
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        ttl: 60 * 60, // 1 hour
      }),
    }),
    HttpModule,
  TypeOrmModule.forFeature([
        OnboardingUser,
        UserBeneficiary,
        UserTransaction,
        Tier,
      ]),],          
  providers: [WhatsappApiService,WhatsappEventFilterService,TransferParserService,VasService,BankResolverService,TransferService, RubiesKYCService,RubiesVirtualAccountService, RubiesService,CacheService, UserService, WhatsappWebhookService, OnboardingFlowService],
  controllers:[WhatsappAPIWebhookController],
  exports: [WhatsappApiService],  
})
export class WhatsappApiModule {}