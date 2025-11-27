import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation-schema';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { UsersModule } from './users/users.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [
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
