import { BotContext } from "../../types/bot";
import { UserService } from "../../services/user";
import { AppDataSource } from "../../config/database";
import { UserInvoice } from "../../entities/user-invoice";
import { formatInvoiceDetailMessage } from "../utils/user";
import { createInvoiceDetailKeyboard } from "../keyboards/invoices";
import logger from '../../utils/logger';

/**
 * Handles the /start command
 */
export async function handleStart(ctx: BotContext): Promise<void> {
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    // Check if this is a callback from xRocket Pay with invoice parameter
    const startParam = ctx.match;
    if (startParam && typeof startParam === 'string' && startParam.startsWith('invoice_')) {
        const invoiceId = startParam.replace('invoice_', '');
        logger.info('[HandleStart] Invoice callback received:', invoiceId);
        
        try {
            // Get invoice from database
            const invoiceRepo = AppDataSource.getRepository(UserInvoice);
            const invoice = await invoiceRepo.findOne({ 
                where: { id: parseInt(invoiceId) },
                relations: ['user']
            });

            if (invoice) {
                // Show invoice details
                const message = formatInvoiceDetailMessage(invoice);
                await ctx.reply(message, { reply_markup: createInvoiceDetailKeyboard(invoice) });
                return;
            }
        } catch (error) {
            logger.error('[HandleStart] Error handling invoice callback:', error);
        }
    }
    
    // Default behavior - show balance
    await userService.displayBalance(ctx, user);
} 