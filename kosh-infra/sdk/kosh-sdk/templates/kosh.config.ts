// Kosh Configuration Template
// Copy this file to your project root and customize

export default {
  projectSlug: 'my-project', // Unique project identifier
  apiUrl: 'http://localhost:3000', // Kosh API endpoint
  apiKey: 'your-api-key-here', // API authentication key
  environment: 'development' as const, // development | staging | production

  integrations: {
    email: {
      provider: 'resend', // resend | smtp | sendgrid
      apiKey: process.env.RESEND_API_KEY,
    },
    telegram: {
      token: process.env.TELEGRAM_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
    },
  },
} as const
