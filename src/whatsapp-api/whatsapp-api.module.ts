import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsappApiService } from './whatsapp-api.service';

@Module({
  imports: [HttpModule],          // ✔ gives HttpService
  providers: [WhatsappApiService],
  exports: [WhatsappApiService],  // ✔ allows other modules to use it
})
export class WhatsappApiModule {}