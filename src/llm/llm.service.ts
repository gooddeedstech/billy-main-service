import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly configService: ConfigService) {}

  async processUserMessage(payload: {
    from: string;
    text: string;
    userId?: string;
  }): Promise<string> {
    const baseUrl = this.configService.get<string>('llm.baseUrl');
    const apiKey = this.configService.get<string>('llm.apiKey');

    try {
      const res = await axios.post(
        `${baseUrl}/v1/chat`,
        {
          user: payload.from,
          message: payload.text,
          metadata: { userId: payload.userId },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      return res.data?.reply || 'I am here to help you with your finances.';
    } catch (error: any) {
      this.logger.error(`LLM error: ${error.message}`, error.stack);
      return 'Sorry, something went wrong while thinking. Please try again.';
    }
  }
}
