import { BotContext } from "../../types/bot";
import { UserService } from "../../services/user";
import { AppDataSource } from "../../config/database";
import { UserInvoice } from "../../entities/user-invoice";
import { createInvoiceDetailKeyboard } from "../keyboards/invoices";
import { createMainMenuKeyboard } from "../keyboards/main";
import { ErrorHandler, ErrorType } from "../utils/error-handler";
import { MessageService } from "../services/message-service";
import logger from '../../utils/logger';

const errorHandler = ErrorHandler.getInstance();

/**
 * Handles the /start command
 */
export async function handleStart(ctx: BotContext): Promise<void> {
    const userService = UserService.getInstance();
    const messageService = MessageService.getInstance();
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
                const message = userService.formatInvoiceDetailMessage(invoice);
                await messageService.editMessage(ctx, message, createInvoiceDetailKeyboard(invoice));
                return;
            }
        } catch (error) {
            errorHandler.logError(error, ErrorType.DATABASE_ERROR, {
                conversation: 'commands',
                action: 'handle_start_invoice',
                data: { invoiceId }
            });
        }
    }
    
    // Get balance and combine with welcome message
    const balances = await userService.getUserBalances(user);
    const balanceMessage = userService.formatBalanceMessage(balances);
    
    const welcomeMessage = `🤖 <b>Demo Bot Information</b>

This is a demo-bot to demonstrate abilities of xRocket Pay: payment API from @xRocket bot

📚 <b>Resources:</b>
• Source code: <a href="https://github.com/xrocket-tg/xrocket-pay-example-bot">GitHub Repository</a>
• TypeScript SDK: <a href="https://www.npmjs.com/package/xrocket-pay-api-sdk">npm Package</a>
• API Documentation: <a href="https://pay.xrocket.tg/api#/">Swagger UI</a>
• API Schema: <a href="https://pay.xrocket.tg/api-json">OpenAPI JSON</a>

⚠️ <b>Warning:</b> This bot is created for testing purposes. If you want to reuse this code for production, please do it on your own risk.

🐛 <b>Support:</b>
• Report issues: <a href="https://github.com/xrocket-tg/xrocket-pay-example-bot/issues">GitHub Issues</a>
• Join chat: <a href="https://t.me/+mA9IoHSdvIRhZjFi">Telegram Community</a>

----------------------

${balanceMessage}`;
    
    await ctx.reply(welcomeMessage, { 
        parse_mode: "HTML", 
        disable_web_page_preview: true,
        reply_markup: createMainMenuKeyboard()
    });
} 