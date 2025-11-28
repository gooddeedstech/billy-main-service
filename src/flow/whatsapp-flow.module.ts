import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappFlowController } from './whatsapp-flow.controller';
import { WhatsappFlowService } from './whatsapp-flow.service';
import { User } from '@/entities/users.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [WhatsappFlowController],
  providers: [WhatsappFlowService],
})
export class WhatsappFlowModule {}