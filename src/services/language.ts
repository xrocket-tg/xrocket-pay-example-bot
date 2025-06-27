import { BotContext } from "../types/bot";
import { SupportedLanguage } from "../entities/user";
import logger from "../utils/logger";

/**
 * Service for handling language detection and management
 */
export class LanguageService {
    private static instance: LanguageService;

    private constructor() {}

    public static getInstance(): LanguageService {
        if (!LanguageService.instance) {
            LanguageService.instance = new LanguageService();
        }
        return LanguageService.instance;
    }

    /**
     * Detects user language from Telegram context
     * @param ctx - The bot context
     * @returns Detected language or 'en' as fallback
     */
    public detectUserLanguage(ctx: BotContext): SupportedLanguage {
        if (!ctx.from) {
            logger.warn('[LanguageService] No user context found, using fallback language');
            return 'en';
        }

        // Get language from Telegram user object
        const telegramLanguage = ctx.from.language_code;
        
        if (!telegramLanguage) {
            logger.info('[LanguageService] No language code found, using fallback language');
            return 'en';
        }

        // Map Telegram language codes to supported languages
        const languageMap: Record<string, SupportedLanguage> = {
            'ru': 'ru',
            'en': 'en',
            'uk': 'ru', // Ukrainian -> Russian
            'be': 'ru', // Belarusian -> Russian
            'kk': 'ru', // Kazakh -> Russian
            'ky': 'ru', // Kyrgyz -> Russian
            'tg': 'ru', // Tajik -> Russian
            'uz': 'ru', // Uzbek -> Russian
        };

        const detectedLanguage = languageMap[telegramLanguage.toLowerCase()];
        
        if (detectedLanguage) {
            logger.info('[LanguageService] Detected language:', {
                telegramLanguage,
                mappedLanguage: detectedLanguage,
                userId: ctx.from.id
            });
            return detectedLanguage;
        }

        logger.info('[LanguageService] Unsupported language, using fallback:', {
            telegramLanguage,
            userId: ctx.from.id
        });
        return 'en';
    }

    /**
     * Validates if a language is supported
     * @param language - The language to validate
     * @returns True if supported, false otherwise
     */
    public isSupportedLanguage(language: string): language is SupportedLanguage {
        return language === 'en' || language === 'ru';
    }

    /**
     * Gets the default language
     * @returns Default language
     */
    public getDefaultLanguage(): SupportedLanguage {
        return 'en';
    }

    /**
     * Gets all supported languages
     * @returns Array of supported languages
     */
    public getSupportedLanguages(): SupportedLanguage[] {
        return ['en', 'ru'];
    }
} 