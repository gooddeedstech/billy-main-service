import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation-schema';
import { LlmModule } from './llm/llm.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingUser } from './entities/users.entity';
import { OnboardingFlowModule } from './flows/on-boading/onboarding-flow.module';
import { WhatsappApiModule } from './whatsapp/whatsapp-api.module';
import { RubiesVirtualAccountModule } from './rubies/rubies-virtual-account.module';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.registerAsync({
  isGlobal: true,
  useFactory: async () => ({
    store: await redisStore({
      url: process.env.REDIS_URL,   // ✅ REQUIRED FOR RAILWAY
      ttl: 60 * 5,                  // 5 mins
    }),
  }),
}),
    ConfigModule.forRoot({
      isGlobal: true,        // VERY IMPORTANT
      envFilePath: '.env',   // (optional) ensure .env is loaded
    }),
    TypeOrmModule.forRoot({
      // your DB config 
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true, 
      synchronize: true, 
    }),
   // WhatsappModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    LlmModule,
    OnboardingFlowModule,
    WhatsappApiModule,
    RubiesVirtualAccountModule,
    
  ],
})
export class AppModule {}
