import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsappApiService } from './whatsapp-api.service';
import { WhatsappAPIWebhookController } from './webhook.controller';
import { WhatsappWebhookService } from './webhook.service';
import { UsersService } from '@/users/users.service';
import { OnboardingFlowService } from '@/flows/on-boading/onboarding-flow.service';
import { WhatsappEventFilterService } from './filters/whatsapp-event-filter.service';

@Module({
  imports: [HttpModule],          
  providers: [WhatsappApiService,WhatsappEventFilterService, WhatsappWebhookService, UsersService, OnboardingFlowService],
  controllers:[WhatsappAPIWebhookController],
  exports: [WhatsappApiService],  
})
export class WhatsappApiModule {}