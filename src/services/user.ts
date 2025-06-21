import { AppDataSource } from "../config/database";
import { User } from "../entities/user";
import { UserBalance } from "../entities/user-balance";
import { UserInvoice } from "../entities/user-invoice";
import { BotContext } from "../types/bot";
import { InternalCurrency, CURRENCIES, CurrencyConverter } from "../types/currency";
import { formatNumber } from "../bot/utils/formatters";
import { createMainMenuKeyboard } from "../bot/keyboards/main";
import { DataSource } from "typeorm";

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
     * Gets or creates a user based on Telegram context
     * @param ctx - The bot context
     * @returns The user instance
     */
    public async findOrCreateUser(ctx: BotContext): Promise<User> {
        const userRepo = AppDataSource.getRepository(User);
        const telegramId = ctx.from?.id;
        
        if (!telegramId) {
            throw new Error("Telegram ID not found in context");
        }

        let user = await userRepo.findOne({ where: { telegramId } });

        if (!user && ctx.from) {
            user = User.create(
                telegramId,
                ctx.from.username || `user_${telegramId}`
            );
            await userRepo.save(user);
        }

        return user!;
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
     * Gets user balances from database
     * @param user - The user instance
     * @returns Array of user balances
     */
    public async getUserBalances(user: User): Promise<UserBalance[]> {
        const balanceRepo = AppDataSource.getRepository(UserBalance);
        return await balanceRepo.find({ where: { user: { id: user.id } } });
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
        manager?: DataSource
    ): Promise<UserBalance> {
        if (typeof amount !== 'number' || isNaN(amount)) {
            throw new Error("Invalid amount provided");
        }

        const balanceRepo = manager ? manager.getRepository(UserBalance) : AppDataSource.getRepository(UserBalance);
        let balance = await this.getUserBalance(user, currency);
        
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
     * @returns Formatted balance message
     */
    public formatBalanceMessage(balances: UserBalance[]): string {
        let message = "💰 Your balance:\n";
        if (balances.length === 0) {
            message += "No balances yet";
        } else {
            balances.forEach(balance => {
                const currencyConfig = CurrencyConverter.getConfig(balance.coin as InternalCurrency);
                message += `${currencyConfig.emoji} ${currencyConfig.name}: ${formatNumber(balance.amount)}\n`;
            });
        }
        return message;
    }

    /**
     * Gets user invoices with pagination
     * @param user - The user instance
     * @param page - Page number (0-based)
     * @param pageSize - Number of items per page
     * @returns Object with invoices, pagination info, and message
     */
    public async getUserInvoicesWithPagination(
        user: User, 
        page: number = 0, 
        pageSize: number = 5
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

        let message = "📋 Your invoices:\n\n";
        if (allInvoices.length === 0) {
            message += "No invoices yet";
        } else {
            message += `Showing ${startIndex + 1}-${Math.min(endIndex, allInvoices.length)} of ${allInvoices.length} invoices`;
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
     * Formats invoice detail message
     * @param invoice - The invoice to format
     * @returns Formatted invoice detail message
     */
    public formatInvoiceDetailMessage(invoice: UserInvoice): string {
        const currencyConfig = CurrencyConverter.getConfig(invoice.currency as InternalCurrency);
        let status: string;
        
        switch (invoice.status) {
            case 'paid':
                status = '✅ Paid';
                break;
            case 'expired':
                status = '❌ Expired';
                break;
            case 'active':
            default:
                status = '⏳ Pending';
                break;
        }
        
        let message = `📄 Invoice Details\n\n`;
        message += `💰 Amount: ${formatNumber(invoice.amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n`;
        message += `📊 Status: ${status}\n`;
        message += `🆔 Invoice ID: ${invoice.invoiceId}\n`;
        message += `📅 Created: ${invoice.createdAt.toLocaleDateString()}\n\n`;

        if (invoice.paymentUrl && invoice.status !== 'paid' && invoice.status !== 'expired') {
            message += `💳 Pay with xRocket Pay:\n${invoice.paymentUrl}`;
        }

        return message;
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

        const balances = await this.getUserBalances(user);
        const message = this.formatBalanceMessage(balances);

        const sent = await ctx.reply(message, { reply_markup: createMainMenuKeyboard() });
        ctx.session.messageId = sent.message_id;
    }
} 