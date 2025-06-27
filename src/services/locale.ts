import { BotContext } from "../types/bot";
import { User, SupportedLanguage } from "../entities/user";
import { UserService } from "./user";
import logger from "../utils/logger";

/**
 * Service for handling localization and translations
 * Integrates with Grammy's i18n package
 */
export class LocaleService {
    private static instance: LocaleService;
    private userService: UserService;

    private constructor() {
        this.userService = UserService.getInstance();
    }

    public static getInstance(): LocaleService {
        if (!LocaleService.instance) {
            LocaleService.instance = new LocaleService();
        }
        return LocaleService.instance;
    }

    /**
     * Gets the user's language preference
     * @param ctx - The bot context
     * @returns The user's language or default language
     */
    public async getUserLanguage(ctx: BotContext): Promise<SupportedLanguage> {
        try {
            const user = await this.userService.findOrCreateUser(ctx);
            return this.userService.getUserLanguage(user);
        } catch (error) {
            logger.warn('[LocaleService] Failed to get user language, using default:', error);
            return 'en';
        }
    }

    /**
     * Gets a localized message for the user
     * @param ctx - The bot context
     * @param key - The translation key (e.g., 'main.welcome')
     * @param params - Optional parameters for message formatting
     * @returns The localized message
     */
    public async getMessage(
        ctx: BotContext, 
        key: string, 
        params?: Record<string, any>
    ): Promise<string> {
        const language = await this.getUserLanguage(ctx);
        
        // Use Grammy's i18n context to get the message
        const message = ctx.t(key, params);
        
        logger.debug('[LocaleService] Getting message:', {
            key,
            language,
            params,
            message: message.substring(0, 100) + '...'
        });
        
        return message;
    }

    /**
     * Gets a localized button text
     * @param ctx - The bot context
     * @param key - The button key (e.g., 'confirm', 'cancel')
     * @returns The localized button text
     */
    public async getButtonText(ctx: BotContext, key: string): Promise<string> {
        return this.getMessage(ctx, `buttons.${key}`);
    }

    /**
     * Gets a localized error message
     * @param ctx - The bot context
     * @param key - The error key (e.g., 'invalid_amount', 'insufficient_balance')
     * @param params - Optional parameters for error message formatting
     * @returns The localized error message
     */
    public async getErrorMessage(
        ctx: BotContext, 
        key: string, 
        params?: Record<string, any>
    ): Promise<string> {
        return this.getMessage(ctx, `errors.${key}`, params);
    }

    /**
     * Gets a localized status text
     * @param ctx - The bot context
     * @param key - The status key (e.g., 'pending', 'completed')
     * @returns The localized status text
     */
    public async getStatusText(ctx: BotContext, key: string): Promise<string> {
        return this.getMessage(ctx, `status.${key}`);
    }

    /**
     * Formats a currency amount with proper localization
     * @param ctx - The bot context
     * @param amount - The amount to format
     * @param currency - The currency code
     * @returns The formatted currency string
     */
    public async formatCurrency(
        ctx: BotContext, 
        amount: number, 
        currency: string
    ): Promise<string> {
        const language = await this.getUserLanguage(ctx);
        
        // For now, use simple formatting. In the future, we can add proper currency formatting
        // based on the user's locale preferences
        return amount.toFixed(2);
    }

    /**
     * Updates user's language preference
     * @param ctx - The bot context
     * @param language - The new language preference
     * @returns The updated user instance
     */
    public async updateUserLanguage(
        ctx: BotContext, 
        language: SupportedLanguage
    ): Promise<User> {
        const user = await this.userService.findOrCreateUser(ctx);
        return await this.userService.updateUserLanguage(user, language);
    }
} 