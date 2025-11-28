import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappFlowController } from './whatsapp-flow.controller';
import { WhatsappFlowService } from './whatsapp-flow.service';
import { OnboardingUser } from '@/entities/users.entity';


@Module({
  imports: [TypeOrmModule.forFeature([OnboardingUser])],
  controllers: [WhatsappFlowController],
  providers: [WhatsappFlowService],
  exports: [WhatsappFlowService],
})
export class WhatsappFlowModule {}