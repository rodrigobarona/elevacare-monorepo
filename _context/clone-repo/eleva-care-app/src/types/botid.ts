/**
 * BotID Type Definitions
 *
 * Complete type definitions for Vercel BotID responses.
 * The official botid package has incomplete types, so we define them here.
 *
 * @see https://vercel.com/docs/botid/verified-bots
 */

/**
 * Complete BotID verification result
 *
 * The official @vercel/botid type only includes:
 * - isHuman: boolean
 * - isBot: boolean
 * - isVerifiedBot: boolean
 * - bypassed: boolean
 *
 * But according to the Vercel documentation, it also includes:
 * - verifiedBotName: string (e.g., "chatgpt-operator", "googlebot")
 * - verifiedBotCategory: string (e.g., "ai-assistant", "search-engine")
 */
export interface BotIdVerificationResult {
  /**
   * Whether the request is from a bot
   */
  isBot: boolean;

  /**
   * Whether the request is from a human
   */
  isHuman: boolean;

  /**
   * Whether the bot is verified by Vercel
   * Verified bots include search engines, AI assistants, and monitoring services
   */
  isVerifiedBot: boolean;

  /**
   * Whether the check was bypassed (development mode)
   */
  bypassed: boolean;

  /**
   * Name of the verified bot (only present if isVerifiedBot is true)
   * Examples: "googlebot", "chatgpt-operator", "pingdom-bot"
   */
  verifiedBotName?: string;

  /**
   * Category of the verified bot (only present if isVerifiedBot is true)
   * Examples: "search-engine", "ai-assistant", "monitoring"
   */
  verifiedBotCategory?: string;
}

/**
 * Type guard to check if a bot verification result includes verified bot details
 */
export function isVerifiedBot(
  result: BotIdVerificationResult,
): result is BotIdVerificationResult & {
  verifiedBotName: string;
  verifiedBotCategory: string;
} {
  return result.isVerifiedBot && !!result.verifiedBotName && !!result.verifiedBotCategory;
}

/**
 * List of commonly allowed verified bots for monitoring and testing
 */
export const COMMON_ALLOWED_BOTS = [
  'pingdom-bot',
  'uptime-robot',
  'checkly',
  'uptimerobot',
  'statuspage',
] as const;

/**
 * List of search engine bots that should typically be allowed
 */
export const SEARCH_ENGINE_BOTS = [
  'googlebot',
  'bingbot',
  'slurp', // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
] as const;

/**
 * List of AI assistant bots
 */
export const AI_ASSISTANT_BOTS = ['chatgpt-operator', 'claude-bot', 'perplexitybot'] as const;
