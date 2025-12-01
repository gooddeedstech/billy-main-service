// import { 
//   Controller, 
//   Get, 
//   Query, 
//   BadRequestException, 
//   Logger 
// } from '@nestjs/common';
// import { BankResolverService } from '@/billy/bank-transfer/bank-resolver.service';

// @Controller('bank-resolver')
// export class BankResolverController {
//   private readonly logger = new Logger(BankResolverController.name);

//   constructor(private readonly bankResolver: BankResolverService) {}

//   /**
//    * 🔍 Resolve bank by name or text query
//    * Example: /bank-resolver/search?query=gtb
//    */
//   @Get('search')
//   async searchBank(@Query('query') query: string) {
//     if (!query || query.length < 2) {
//       throw new BadRequestException('query is required and must be at least 2 characters');
//     }

//     this.logger.log(`🔍 Searching bank for: ${query}`);

//     const result = this.bankResolver.detectBankFromText(query);

//     return {
//       success: true,
//       message: 'Text-based bank detection result',
//       ...result
//     };
//   }

//   /**
//    * 🏦 Resolve bank + perform name enquiry
//    * Example:
//    * /bank-resolver/resolve?bank=gtbank&accountNumber=0023345566
//    */
//   @Get('resolve')
//   async resolve(
//     @Query('bank') bank: string,
//     @Query('accountNumber') accountNumber: string,
//   ) {
//     if (!bank) throw new BadRequestException('bank is required');
//     if (!accountNumber) throw new BadRequestException('accountNumber is required');

//     this.logger.log(`🏦 Resolving bank="${bank}" for account=${accountNumber}`);

//     const response = await this.bankResolver.resolveBank(bank, accountNumber);

//     return {
//       success: true,
//       message: 'Bank resolution completed',
//       data: response,
//     };
//   }

//   /**
//    * 🔥 Resolve bank ONLY via Name Enquiry brute force
//    * Example:
//    * /bank-resolver/enquiry?accountNumber=0023345566
//    */
//   @Get('enquiry')
//   async performNameEnquiry(@Query('accountNumber') accountNumber: string) {
//     if (!accountNumber) {
//       throw new BadRequestException('accountNumber is required');
//     }

//     this.logger.log(`🔍 Brute-force name-enquiry for account=${accountNumber}`);

//     const result = await this.bankResolver.detectBankViaEnquiry(accountNumber);

//     return {
//       success: true,
//       count: result.length,
//       results: result,
//     };
//   }
// }