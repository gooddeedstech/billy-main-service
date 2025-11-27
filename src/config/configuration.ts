export default () => ({
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    onboardingFlowId: process.env.WHATSAPP_ONBOARDING_FLOW_ID,
    onboardingFlowVersion: process.env.WHATSAPP_ONBOARDING_FLOW_VERSION || '1.0',
  },
  llm: {
    baseUrl: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
  },
});
