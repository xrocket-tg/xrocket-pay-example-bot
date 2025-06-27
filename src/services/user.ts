import { BotContext } from "../types/bot";
import { AppDataSource } from "../config/database";
import { User, SupportedLanguage } from "../entities/user";
import { UserBalance } from "../entities/user-balance";
import { UserInvoice } from "../entities/user-invoice";
import { CurrencyConverter, InternalCurrency } from "../types/currency";
import { formatCurrency } from "../bot/utils/formatters";
import { createMainMenuKeyboard } from "../bot/keyboards/main";
import { EntityManager } from "typeorm";
import { MessageService } from "../bot/services/message-service";
import { LanguageService } from "./language";
import logger from "../utils/logger";

/**
 * Service for managing user-related operations
 */
export class UserService {
    private static instance: UserService;

    private constructor() {}

    public static getInstance(): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService();
        }
        return UserService.instance;
    }

    /**
     * Finds or creates a user based on Telegram context
     * @param ctx - The bot context
     * @returns The user instance
     */
    public async findOrCreateUser(ctx: BotContext): Promise<User> {
        if (!ctx.from) {
            throw new Error("User information not found in context");
        }

        const userRepo = AppDataSource.getRepository(User);
        let user = await userRepo.findOne({ where: { telegramId: ctx.from.id } });

        if (!user) {
            // Create new user with detected language
            const languageService = LanguageService.getInstance();
            const detectedLanguage = languageService.detectUserLanguage(ctx);
            
            user = User.create(ctx.from.id, ctx.from.username || `user_${ctx.from.id}`, detectedLanguage);
            await userRepo.save(user);
            
            logger.info('[UserService] Created new user with language:', {
                userId: user.id,
                telegramId: user.telegramId,
                language: detectedLanguage
            });
        } else if (!user.language) {
            // Update existing user with detected language if not set
            const languageService = LanguageService.getInstance();
            const detectedLanguage = languageService.detectUserLanguage(ctx);
            
            user.language = detectedLanguage;
            await userRepo.save(user);
            
            logger.info('[UserService] Updated existing user with language:', {
                userId: user.id,
                telegramId: user.telegramId,
                language: detectedLanguage
            });
        }

        return user;
    }

    /**
     * Gets user by Telegram ID
     * @param telegramId - The Telegram user ID
     * @returns The user instance or null if not found
     */
    public async getUserByTelegramId(telegramId: number): Promise<User | null> {
        const userRepo = AppDataSource.getRepository(User);
        return await userRepo.findOne({ where: { telegramId } });
    }

    /**
     * Gets user language preference
     * @param user - The user instance
     * @returns The user's language preference or default language
     */
    public getUserLanguage(user: User): SupportedLanguage {
        const languageService = LanguageService.getInstance();
        return user.language || languageService.getDefaultLanguage();
    }

    /**
     * Updates user language preference
     * @param user - The user instance
     * @param language - The new language preference
     * @returns The updated user instance
     */
    public async updateUserLanguage(user: User, language: SupportedLanguage): Promise<User> {
        const languageService = LanguageService.getInstance();
        
        if (!languageService.isSupportedLanguage(language)) {
            throw new Error(`Unsupported language: ${language}`);
        }

        const userRepo = AppDataSource.getRepository(User);
        user.language = language;
        await userRepo.save(user);
        
        logger.info('[UserService] Updated user language:', {
            userId: user.id,
            telegramId: user.telegramId,
            language
        });
        
        return user;
    }

    /**
     * Gets all user balances
     * @param user - The user instance
     * @returns Array of user balances
     */
    public async getUserBalances(user: User): Promise<UserBalance[]> {
        const balanceRepo = AppDataSource.getRepository(UserBalance);
        return await balanceRepo.find({ 
            where: { user: { id: user.id } },
            order: { coin: 'ASC' }
        });
    }

    /**
     * Gets user balance for specific currency
     * @param user - The user instance
     * @param currency - The currency to get balance for
     * @returns The balance instance or null if not found
     */
    public async getUserBalance(user: User, currency: InternalCurrency): Promise<UserBalance | null> {
        const balanceRepo = AppDataSource.getRepository(UserBalance);
        return await balanceRepo.findOne({ 
            where: { user: { id: user.id }, coin: currency }
        });
    }

    /**
     * Updates user balance with validation
     * @param user - The user instance
     * @param currency - The currency to update
     * @param amount - The amount to add/subtract (positive for add, negative for subtract)
     * @param manager - Optional transaction manager
     * @returns The updated balance instance
     */
    public async updateBalance(
        user: User, 
        currency: InternalCurrency, 
        amount: number, 
        manager?: EntityManager
    ): Promise<UserBalance> {
        if (typeof amount !== 'number' || isNaN(amount)) {
            throw new Error("Invalid amount provided");
        }

        const balanceRepo = manager ? manager.getRepository(UserBalance) : AppDataSource.getRepository(UserBalance);
        
        // Get balance using the same manager
        let balance = manager 
            ? await balanceRepo.findOne({ where: { user: { id: user.id }, coin: currency } })
            : await this.getUserBalance(user, currency);
        
        if (!balance) {
            // Create new balance if it doesn't exist
            balance = UserBalance.create(user, currency, 0);
        }

        // Update balance
        const currentAmount = parseFloat(balance.amount.toString());
        const newAmount = currentAmount + amount;
        
        if (newAmount < 0) {
            throw new Error(`Insufficient balance. Current: ${currentAmount}, Requested: ${Math.abs(amount)}`);
        }

        balance.amount = newAmount;
        
        return await balanceRepo.save(balance);
    }

    /**
     * Creates or updates user balance (for deposits)
     * @param user - The user instance
     * @param currency - The currency
     * @param amount - The amount to set
     * @returns The balance instance
     */
    public async setBalance(user: User, currency: InternalCurrency, amount: number): Promise<UserBalance> {
        if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
            throw new Error("Invalid amount provided");
        }

        const balanceRepo = AppDataSource.getRepository(UserBalance);
        let balance = await this.getUserBalance(user, currency);
        
        if (!balance) {
            // Create new balance if it doesn't exist
            balance = UserBalance.create(user, currency, amount);
        } else {
            balance.amount = amount;
        }
        
        return await balanceRepo.save(balance);
    }

    /**
     * Formats user balance into a display message
     * @param balances - Array of user balances
     * @param ctx - The bot context for i18n
     * @returns Formatted balance message
     */
    public formatBalanceMessage(balances: UserBalance[], ctx: BotContext): string {
        let message = ctx.t('balance-title') + '\n';
        if (balances.length === 0) {
            message += ctx.t('balance-no-balance');
        } else {
            balances.forEach(balance => {
                const currencyConfig = CurrencyConverter.getConfig(balance.coin as InternalCurrency);
                message += ctx.t('balance-currency-format', {
                    emoji: currencyConfig.emoji,
                    name: currencyConfig.name,
                    amount: formatCurrency(balance.amount)
                }) + '\n';
            });
        }
        return message;
    }

    /**
     * Gets user invoices with pagination
     * @param user - The user instance
     * @param page - Page number (0-based)
     * @param pageSize - Number of items per page
     * @param ctx - The bot context for i18n
     * @returns Object with invoices, pagination info, and message
     */
    public async getUserInvoicesWithPagination(
        user: User, 
        page: number = 0, 
        pageSize: number = 5,
        ctx?: BotContext
    ): Promise<{
        invoices: UserInvoice[];
        allInvoices: UserInvoice[];
        page: number;
        pageSize: number;
        startIndex: number;
        endIndex: number;
        message: string;
    }> {
        const invoiceRepo = AppDataSource.getRepository(UserInvoice);
        const allInvoices = await invoiceRepo.find({ 
            where: { user: { id: user.id } },
            order: { createdAt: 'DESC' }
        });

        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const invoices = allInvoices.slice(startIndex, endIndex);

        let message = ctx ? ctx.t('invoices-title') + '\n\n' : '📋 Your invoices:\n\n';
        if (invoices.length === 0) {
            message += ctx ? ctx.t('error-no-invoices') : 'No invoices yet';
        } else {
            message += ctx ? ctx.t('invoices-pagination', { start: startIndex + 1, end: Math.min(endIndex, allInvoices.length), total: allInvoices.length }) : `Showing ${startIndex + 1}-${Math.min(endIndex, allInvoices.length)} of ${allInvoices.length} invoices`;
        }

        return {
            invoices,
            allInvoices,
            page,
            pageSize,
            startIndex,
            endIndex,
            message
        };
    }

    /**
     * Formats invoice detail message (localized)
     * @param invoice - The invoice to format
     * @param ctx - The bot context for i18n
     * @returns Formatted invoice detail message
     */
    public async formatInvoiceDetailMessage(invoice: UserInvoice, ctx: BotContext): Promise<string> {
        const currencyConfig = CurrencyConverter.getConfig(invoice.currency as InternalCurrency);
        let statusKey: string;
        let statusEmoji: string;
        switch (invoice.status) {
            case 'paid':
                statusKey = 'status-paid';
                statusEmoji = '✅';
                break;
            case 'expired':
                statusKey = 'status-failed';
                statusEmoji = '❌';
                break;
            case 'active':
            default:
                statusKey = 'status-pending';
                statusEmoji = '⏳';
                break;
        }

        let paymentInfo = '';
        if (invoice.paymentUrl && invoice.status !== 'paid' && invoice.status !== 'expired') {
            paymentInfo = `\n${ctx.t('invoices-pay-with-xrocket')}:\n${invoice.paymentUrl}\n`;
        }
        paymentInfo += '\n' + ctx.t('invoices-payment-info');

        // Add amount received and fee information for paid invoices
        let amountReceivedInfo = '';
        if (invoice.status === 'paid' && invoice.paymentAmountReceived !== undefined) {
            const fee = parseFloat(invoice.amount.toString()) - invoice.paymentAmountReceived;
            amountReceivedInfo = ctx.t('invoices-amount-received-info', {
                amountReceived: formatCurrency(invoice.paymentAmountReceived),
                fee: formatCurrency(fee),
                emoji: currencyConfig.emoji,
                name: currencyConfig.name
            });
        }

        return ctx.t('invoices-invoice-detail', {
            amount: formatCurrency(invoice.amount),
            emoji: currencyConfig.emoji,
            name: currencyConfig.name,
            statusEmoji,
            status: ctx.t(statusKey),
            invoiceId: invoice.invoiceId,
            createdAt: invoice.createdAt.toLocaleDateString(),
            paymentInfo,
            amountReceivedInfo
        });
    }

    /**
     * Displays user's balance
     * @param ctx - The bot context
     * @param user - The user whose balance to display
     */
    public async displayBalance(ctx: BotContext, user: User): Promise<void> {
        if (!ctx.chat) {
            throw new Error("Chat context not found");
        }

        const messageService = MessageService.getInstance();
        const balances = await this.getUserBalances(user);
        const message = this.formatBalanceMessage(balances, ctx);

        await messageService.editMessage(ctx, message, createMainMenuKeyboard(ctx));
    }
} 