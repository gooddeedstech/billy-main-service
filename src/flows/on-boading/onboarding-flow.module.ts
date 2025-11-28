import { Module } from '@nestjs/common';
import { OnboardingFlowService } from './onboarding-flow.service';
import { WhatsappApiModule } from '@/whatsapp-api/whatsapp-api.module';
import { OnboardingFlowController } from './onboarding-flow.controller';



@Module({
  imports: [
    WhatsappApiModule,   
  ],
  providers: [OnboardingFlowService],
  controllers: [OnboardingFlowController],
  exports: [OnboardingFlowService],
})
export class OnboardingFlowModule {} 