import { IsOptional, IsObject } from 'class-validator';

export class WebhookEventDto {
  @IsOptional()
  @IsObject()
  entry?: any;
}
