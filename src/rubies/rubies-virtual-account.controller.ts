import { Body, Controller, Post, HttpCode, Logger, BadRequestException } from '@nestjs/common';
import { RubiesVirtualAccountService } from './rubies-virtual-account.service';
import { RubiesCreateVirtualAccountDto } from './dto/create-virtual-account.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BankResolverService } from '@/billy/bank-transfer/bank-resolver.service';
import { ResolveBankDto } from './dto/resolve-bank.dto';

@ApiTags('Rubies Virtual Account')
@Controller('rubies/virtual-account')
export class RubiesVirtualAccountController {
  private readonly logger = new Logger(RubiesVirtualAccountController.name);

  constructor(
    private readonly rubiesVAService: RubiesVirtualAccountService,
    private readonly resolver: BankResolverService
  ) {}

  @Post('create')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a virtual account using BVN or NIN' })
  async createVirtualAccount(
    @Body() dto: RubiesCreateVirtualAccountDto,
  ) {
    this.logger.log(`📥 Incoming request to create virtual account: ${dto.reference}`);
    return this.rubiesVAService.createVirtualAccount(dto);
  }

@Post('resolve')
  @ApiOperation({
    summary: 'Resolve bank from message + account number',
    description:
      'Detects destination bank using text ("gtbank", "keystone"), prefixes, and Rubies name-enquiry.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bank(s) successfully resolved',
    type: [ResolveBankDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Unable to determine bank',
  })
  async resolveBank(
    @Body() dto: ResolveBankDto,
  ): Promise<{ success: boolean; count: number; banks: ResolveBankDto[] }> {
    const { bank, accountNumber } = dto;

    const result = await this.resolver.resolveBank(bank, accountNumber);

    if (!result || result.length === 0) {
      throw new BadRequestException({
        success: false,
        message:
          'Unable to determine bank. Please specify bank name or try again.',
      });
    }

    return {
      success: true,
      count: result.length,
      banks: result,
    };
  }


}