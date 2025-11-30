import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RubiesService } from './rubies.service';
import { RubiesKYCService } from './rubie-kyc.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@/entities/audit-log.entity';

 
  
@Module({
  imports: [
    // ✅ Provides axios-based HTTP client with timeout/retries
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
     TypeOrmModule.forFeature([

          AuditLog, 
     
        ]),
  ],
  controllers: [
    ,  
  ],
  providers: [RubiesService, RubiesKYCService, ],
  exports: [RubiesService, RubiesKYCService],
})
export class RubiesModule {}