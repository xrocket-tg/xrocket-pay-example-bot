import { AppDataSource } from "../../config/database";
import { User } from "../../entities/user";
import { UserBalance } from "../../entities/user-balance";
import { UserInvoice } from "../../entities/user-invoice";
import { BotContext } from "../../types/bot";
import { CURRENCIES, CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatNumber } from "./formatters";
import { createMainMenuKeyboard } from "../keyboards/main";

/**
 * Gets or creates a user based on Telegram context
 * @param ctx - The bot context
 * @returns The user instance
 */
export async function getOrCreateUser(ctx: BotContext): Promise<User> {
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
 * Formats user balance into a display message
 * @param balances - Array of user balances
 * @returns Formatted balance message
 */
export function formatBalanceMessage(balances: UserBalance[]): string {
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
 * Gets user balances from database
 * @param user - The user instance
 * @returns Array of user balances
 */
export async function getUserBalances(user: User): Promise<UserBalance[]> {
    const balanceRepo = AppDataSource.getRepository(UserBalance);
    return await balanceRepo.find({ where: { user: { id: user.id } } });
}

/**
 * Gets user invoices with pagination
 * @param user - The user instance
 * @param page - Page number (0-based)
 * @param pageSize - Number of items per page
 * @returns Object with invoices, pagination info, and message
 */
export async function getUserInvoicesWithPagination(
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
export function formatInvoiceDetailMessage(invoice: UserInvoice): string {
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
        message += `💳 Pay with XRocket Pay:\n${invoice.paymentUrl}`;
    }

    return message;
}

/**
 * Displays user's balance
 * @param ctx - The bot context
 * @param user - The user whose balance to display
 */
export async function displayBalance(ctx: BotContext, user: User): Promise<void> {
    if (!ctx.chat) {
        throw new Error("Chat context not found");
    }

    const balances = await getUserBalances(user);
    const message = formatBalanceMessage(balances);

    const sent = await ctx.reply(message, { reply_markup: createMainMenuKeyboard() });
    ctx.session.messageId = sent.message_id;
} 