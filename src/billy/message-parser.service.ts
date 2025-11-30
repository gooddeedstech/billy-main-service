// import { Injectable } from "@nestjs/common";

// @Injectable()
// export class MessageParserService {
//   parse(message: string) {
//     const amountMatch = message.match(/(\d+)[kK]?/);
//     const accountMatch = message.match(/\b\d{10}\b/);

//     return {
//       amount: amountMatch ? 
//         (message.includes('k') ? parseInt(amountMatch[1]) * 1000 : parseInt(amountMatch[1])) 
//         : null,

//       accountNumber: accountMatch ? accountMatch[0] : null,
//       raw: message,
//     };
//   }
// }