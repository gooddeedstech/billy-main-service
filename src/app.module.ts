import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation-schema';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { UsersModule } from './users/users.module';
import { LlmModule } from './llm/llm.module';
import { WhatsappFlowModule } from './flow/whatsapp-flow.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/users.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,        // VERY IMPORTANT
      envFilePath: '.env',   // (optional) ensure .env is loaded
    }),
    TypeOrmModule.forRoot({
      // your DB config
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User],
      synchronize: false, // true only in dev if you like
    }),
    WhatsappFlowModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    UsersModule,
    LlmModule,
    WhatsappModule,
  ],
})
export class AppModule {}
