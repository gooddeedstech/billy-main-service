import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { RubiesVirtualAccountService } from './rubies-virtual-account.service';
import { RubiesVirtualAccountController } from './rubies-virtual-account.controller';
import { BankResolverService } from '@/billy/bank-transfer/bank-resolver.service';
import { RubiesService } from './rubies.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [RubiesVirtualAccountController],
  providers: [RubiesVirtualAccountService, BankResolverService, RubiesService],
  exports: [RubiesVirtualAccountService, BankResolverService],
})
export class RubiesVirtualAccountModule {}