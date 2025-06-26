import { BotContext } from "../types/bot";
import { AppDataSource } from "../config/database";
import { User } from "../entities/user";
import { UserBalance } from "../entities/user-balance";
import { UserInvoice } from "../entities/user-invoice";
import { CurrencyConverter, InternalCurrency } from "../types/currency";
import { formatCurrency } from "../bot/utils/formatters";
import { createMainMenuKeyboard } from "../bot/keyboards/main";
import { EntityManager } from "typeorm";
import { MessageService } from "../bot/services/message-service";

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
            user = User.create(ctx.from.id, ctx.from.username || `user_${ctx.from.id}`);
            await userRepo.save(user);
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
     * @returns Formatted balance message
     */
    public formatBalanceMessage(balances: UserBalance[]): string {
        let message = "💰 Your balance:\n";
        if (balances.length === 0) {
            message += "No balances yet";
        } else {
            balances.forEach(balance => {
                const currencyConfig = CurrencyConverter.getConfig(balance.coin as InternalCurrency);
                message += `${currencyConfig.emoji} ${currencyConfig.name}: ${formatCurrency(balance.amount)}\n`;
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
        message += `💰 Amount: ${formatCurrency(invoice.amount)}\n`;
        
        // Add Amount Received field if invoice is paid and has paymentAmountReceived
        if (invoice.status === 'paid' && invoice.paymentAmountReceived !== undefined) {
            const fee = parseFloat(invoice.amount.toString()) - invoice.paymentAmountReceived;
            message += `💸 Amount Received: ${formatCurrency(invoice.paymentAmountReceived)}\n`;
            message += `📊 Fee: ${formatCurrency(fee)}\n`;
        }
        
        message += `📊 Status: ${status}\n`;
        message += `🆔 Invoice ID: ${invoice.invoiceId}\n`;
        message += `📅 Created: ${invoice.createdAt.toLocaleDateString()}\n\n`;

        if (invoice.paymentUrl && invoice.status !== 'paid' && invoice.status !== 'expired') {
            message += `💳 Pay with xRocket Pay:\n${invoice.paymentUrl}\n\n`;
        }

        message += `🔧 <b>Payment Handling Options:</b>\n`;
        message += `💡 Note: You have two ways to handle payment: set up webhooks or simply check invoice status (in a loop or with button). We handle it here via webhooks, but we have added check payment button implementation too, if you don't want to do it via webhooks for some reason.`;

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

        const messageService = MessageService.getInstance();
        const balances = await this.getUserBalances(user);
        const message = this.formatBalanceMessage(balances);

        await messageService.editMessage(ctx, message, createMainMenuKeyboard());
    }
} 