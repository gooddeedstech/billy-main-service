import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  WHATSAPP_VERIFY_TOKEN: Joi.string().required(),
  WHATSAPP_TOKEN: Joi.string().required(),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().required(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string().required(),

  WHATSAPP_ONBOARDING_FLOW_ID: Joi.string().required(),
  WHATSAPP_ONBOARDING_FLOW_VERSION: Joi.string().default('1.0'),

  LLM_BASE_URL: Joi.string().uri().required(),
  LLM_API_KEY: Joi.string().required(),
});
