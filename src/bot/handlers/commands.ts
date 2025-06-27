import { BotContext } from "../../types/bot";
import { UserService } from "../../services/user";
import { AppDataSource } from "../../config/database";
import { UserInvoice } from "../../entities/user-invoice";
import { createInvoiceDetailKeyboard } from "../keyboards/invoices";
import { createMainMenuKeyboard } from "../keyboards/main";
import { ErrorHandler, ErrorType } from "../utils/error-handler";
import { MessageService } from "../services/message-service";
import logger from '../../utils/logger';
import { createLanguageKeyboard } from "../keyboards/lang";
import { LocaleService } from "../../services/locale";
import { SupportedLanguage } from "../../entities/user";

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
                const message = await userService.formatInvoiceDetailMessage(invoice, ctx);
                await messageService.editMessage(ctx, message, createInvoiceDetailKeyboard(invoice, ctx));
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
    const balanceMessage = userService.formatBalanceMessage(balances, ctx);
    
    const welcomeMessage = ctx.t('main-welcome') + '\n\n' + balanceMessage;
    
    await ctx.reply(welcomeMessage, { 
        parse_mode: "HTML", 
        disable_web_page_preview: true,
        reply_markup: createMainMenuKeyboard(ctx)
    } as any);
}

/**
 * Handles the /setlang command
 */
export async function handleSetLang(ctx: BotContext): Promise<void> {
    await ctx.reply(
        ctx.t('language-select'),
        { reply_markup: createLanguageKeyboard() }
    );
}

/**
 * Handles language selection via inline button
 */
export async function handleSetLangCallback(ctx: BotContext): Promise<void> {
    const localeService = LocaleService.getInstance();
    let lang: SupportedLanguage = 'en';
    if (ctx.callbackQuery?.data === 'setlang_ru') lang = 'ru';
    if (ctx.callbackQuery?.data === 'setlang_en') lang = 'en';

    await localeService.updateUserLanguage(ctx, lang);
    ctx.i18n.setLocale(lang);

    await ctx.answerCallbackQuery();
    await ctx.reply(
        ctx.t('language-changed'),
        { reply_markup: createLanguageKeyboard() }
    );
} 