const PROVIDERS = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-pro',
    apiKeyEnv: 'DEEPSEEK_API_KEY'
  },
  openaiCompatible: {
    label: 'OpenAI-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'AI_API_KEY'
  }
}

function cleanBaseUrl(url = '') {
  return String(url || '').trim().replace(/\/$/, '')
}

export function listAiProviders() {
  return Object.entries(PROVIDERS).map(([id, item]) => ({ id, ...item }))
}

export function resolveAiProvider(env = process.env) {
  const providerId = String(env.AI_PROVIDER || 'deepseek').trim()
  const provider = PROVIDERS[providerId] || PROVIDERS.deepseek
  const apiKey = String(
    env.AI_API_KEY ||
    env[provider.apiKeyEnv] ||
    env.DEEPSEEK_API_KEY ||
    ''
  ).trim()
  const baseUrl = cleanBaseUrl(
    env.AI_BASE_URL ||
    env.DEEPSEEK_BASE_URL ||
    provider.baseUrl
  )
  const model = String(
    env.AI_MODEL ||
    env.DEEPSEEK_MODEL ||
    provider.model
  ).trim()

  return {
    providerId: PROVIDERS[providerId] ? providerId : 'deepseek',
    providerLabel: provider.label,
    apiKey,
    baseUrl,
    model
  }
}

