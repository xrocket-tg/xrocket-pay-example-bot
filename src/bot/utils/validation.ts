import { BotContext } from "../../types/bot";
import { UserService } from "../../services/user";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { User } from "../../entities/user";
import logger from "../../utils/logger";
import { formatCurrency } from "./formatters";

/**
 * Validation service for bot conversations
 * Centralizes all validation logic to reduce code duplication
 */
export class ValidationService {
    private static instance: ValidationService;

    private constructor() {}

    public static getInstance(): ValidationService {
        if (!ValidationService.instance) {
            ValidationService.instance = new ValidationService();
        }
        return ValidationService.instance;
    }

    /**
     * Validates amount input from user
     * @param amountText - The amount as text input
     * @returns Parsed amount as number or null if invalid
     */
    public validateAmount(amountText: string): number | null {
        if (!amountText || typeof amountText !== 'string') {
            return null;
        }

        const trimmedAmount = amountText.trim();
        const amount = parseFloat(trimmedAmount);

        if (isNaN(amount) || amount <= 0) {
            return null;
        }

        return amount;
    }

    /**
     * Validates currency selection from callback data
     * @param callbackData - The callback data string
     * @param prefix - The prefix to remove from callback data
     * @returns Validated currency or null if invalid
     */
    public validateCurrency(callbackData: string | undefined, prefix: string): InternalCurrency | null {
        if (!callbackData) {
            return null;
        }

        const currencyCode = callbackData.replace(prefix, '') as InternalCurrency;
        
        if (!CurrencyConverter.isSupportedInternal(currencyCode)) {
            return null;
        }

        return currencyCode;
    }

    /**
     * Validates session data for required fields
     * @param ctx - The bot context
     * @param requiredFields - Array of required session field names
     * @returns True if all required fields are present, false otherwise
     */
    public validateSession(ctx: BotContext, requiredFields: string[]): boolean {
        if (!ctx.session) {
            logger.error('[Validation] No session found');
            return false;
        }

        for (const field of requiredFields) {
            if (!(field in ctx.session) || (ctx.session as any)[field] === undefined) {
                logger.error('[Validation] Missing required session field:', field);
                return false;
            }
        }

        return true;
    }

    /**
     * Validates user balance for a specific amount
     * @param user - The user instance
     * @param currency - The currency to check
     * @param amount - The amount to validate against
     * @returns Object with validation result and available balance
     */
    public async validateBalance(
        user: User, 
        currency: InternalCurrency, 
        amount: number
    ): Promise<{ isValid: boolean; availableBalance: number; errorMessage?: string }> {
        const userService = UserService.getInstance();
        const balance = await userService.getUserBalance(user, currency);
        const availableBalance = balance ? balance.amount : 0;

        if (availableBalance < amount) {
            const currencyConfig = CurrencyConverter.getConfig(currency);
            const formattedAvailable = formatCurrency(availableBalance);
            const formattedAmount = formatCurrency(amount);
            const errorMessage = `❌ Insufficient balance. You have ${formattedAvailable} ${currencyConfig.name}, but trying to use ${formattedAmount} ${currencyConfig.name}.`;
            
            return {
                isValid: false,
                availableBalance,
                errorMessage
            };
        }

        return {
            isValid: true,
            availableBalance
        };
    }

    /**
     * Validates Telegram ID format
     * @param telegramIdText - The Telegram ID as string
     * @returns Parsed Telegram ID as number or null if invalid
     */
    public validateTelegramId(telegramIdText: string): number | null {
        if (!telegramIdText || typeof telegramIdText !== 'string') {
            return null;
        }

        const telegramId = parseInt(telegramIdText.trim());
        
        if (isNaN(telegramId) || telegramId <= 0) {
            return null;
        }

        return telegramId;
    }

    /**
     * Validates wallet address format
     * @param address - The wallet address to validate
     * @returns True if address is valid, false otherwise
     */
    public validateWalletAddress(address: string): boolean {
        if (!address || typeof address !== 'string') {
            return false;
        }

        const trimmedAddress = address.trim();
        
        // Basic validation: address should be at least 5 characters
        if (trimmedAddress.length < 5) {
            return false;
        }

        // Additional validation can be added here based on specific currency requirements
        // For now, we'll use a basic length check
        
        return true;
    }

    /**
     * Validates callback query context
     * @param ctx - The bot context
     * @returns True if context is valid for callback queries, false otherwise
     */
    public validateCallbackContext(ctx: BotContext): boolean {
        if (!ctx.chat || !ctx.callbackQuery) {
            logger.error('[Validation] Invalid context for callback query');
            return false;
        }

        return true;
    }

    /**
     * Validates callback query context with data
     * @param ctx - The bot context
     * @returns True if context is valid for callback queries with data, false otherwise
     */
    public validateCallbackContextWithData(ctx: BotContext): boolean {
        if (!this.validateCallbackContext(ctx)) {
            return false;
        }

        if (!ctx.callbackQuery!.data) {
            logger.error('[Validation] No callback data found');
            return false;
        }

        return true;
    }

    /**
     * Validates message context
     * @param ctx - The bot context
     * @returns True if context is valid for text messages, false otherwise
     */
    public validateMessageContext(ctx: BotContext): boolean {
        if (!ctx.chat || !ctx.message?.text) {
            logger.error('[Validation] Invalid context for text message');
            return false;
        }

        return true;
    }

    /**
     * Validates withdrawal amount including fees
     * @param user - The user instance
     * @param currency - The currency to check
     * @param amount - The withdrawal amount
     * @param fee - The withdrawal fee
     * @returns Object with validation result and details
     */
    public async validateWithdrawalAmount(
        user: User,
        currency: InternalCurrency,
        amount: number,
        fee: number
    ): Promise<{ isValid: boolean; availableBalance: number; totalRequired: number; errorMessage?: string }> {
        const totalRequired = amount + fee;
        const balanceValidation = await this.validateBalance(user, currency, totalRequired);

        if (!balanceValidation.isValid) {
            const currencyConfig = CurrencyConverter.getConfig(currency);
            const formattedTotal = formatCurrency(totalRequired);
            const formattedAmount = formatCurrency(amount);
            const formattedFee = formatCurrency(fee);
            const formattedAvailable = formatCurrency(balanceValidation.availableBalance);
            const errorMessage = `❌ Insufficient balance. You need ${formattedTotal} ${currencyConfig.name} (${formattedAmount} + ${formattedFee} fee), but have ${formattedAvailable} ${currencyConfig.name}.`;
            
            return {
                isValid: false,
                availableBalance: balanceValidation.availableBalance,
                totalRequired,
                errorMessage
            };
        }

        return {
            isValid: true,
            availableBalance: balanceValidation.availableBalance,
            totalRequired
        };
    }

    /**
     * Validates conversation step
     * @param ctx - The bot context
     * @param expectedStep - The expected step name
     * @returns True if step matches, false otherwise
     */
    public validateConversationStep(ctx: BotContext, expectedStep: string): boolean {
        if (!ctx.session?.step) {
            logger.error('[Validation] No step found in session');
            return false;
        }

        if (ctx.session.step !== expectedStep) {
            logger.error('[Validation] Unexpected step:', { expected: expectedStep, actual: ctx.session.step });
            return false;
        }

        return true;
    }

    /**
     * Validates positive number
     * @param value - The value to validate
     * @returns True if value is a positive number, false otherwise
     */
    public validatePositiveNumber(value: number): boolean {
        return typeof value === 'number' && !isNaN(value) && value > 0;
    }

    /**
     * Validates non-negative number
     * @param value - The value to validate
     * @returns True if value is a non-negative number, false otherwise
     */
    public validateNonNegativeNumber(value: number): boolean {
        return typeof value === 'number' && !isNaN(value) && value >= 0;
    }
} 