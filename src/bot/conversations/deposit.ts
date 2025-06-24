import { BotContext } from "../../types/bot";
import { AppDataSource } from "../../config/database";
import { UserInvoice } from "../../entities/user-invoice";
import { createCoinSelectionKeyboard } from "../keyboards/deposit";
import { createMainMenuKeyboard } from "../keyboards/main";
import { formatNumber } from "../utils/formatters";
import { UserService } from "../../services/user";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { InlineKeyboard } from "grammy";
import { XRocketPayService } from "../../services/xrocket-pay";
import logger from '../../utils/logger';
import { createInvoiceDetailKeyboard } from "../keyboards/invoices";

/**
 * Handles the deposit flow using session-based state management
 */
export async function handleDepositFlow(ctx: BotContext): Promise<void> {
    logger.info('[Deposit] Starting deposit flow');
    
    if (!ctx.chat) {
        throw new Error("Chat context not found");
    }

    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    logger.info('[Deposit] User:', user);
    
    // Get message ID from callback query
    const messageId = ctx.callbackQuery?.message?.message_id;
    logger.info('[Deposit] Message ID:', messageId);

    if (!messageId) {
        logger.error('[Deposit] No message ID found');
        throw new Error("Message ID not found");
    }

    // Show currency selection
    logger.info('[Deposit] Showing currency selection');
    await ctx.api.editMessageText(
        ctx.chat.id,
        messageId,
        "💱 Select currency for deposit:",
        { reply_markup: createCoinSelectionKeyboard() }
    );

    // Answer the callback query to remove loading state
    if (ctx.callbackQuery) {
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);
    }
}

/**
 * Handles currency selection in deposit flow
 */
export async function handleCurrencySelection(ctx: BotContext): Promise<void> {
    logger.info('[Deposit] Currency selection received');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for currency selection");
    }

    const selectedCoin = ctx.callbackQuery.data?.replace("coin_", "") as InternalCurrency;
    logger.info('[Deposit] Selected currency:', selectedCoin);
    
    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    if (!selectedCoin || !CurrencyConverter.isSupportedInternal(selectedCoin)) {
        logger.error('[Deposit] Invalid currency selected:', selectedCoin);
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            "❌ Invalid currency selected. Please try again.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    logger.info('[Deposit] Currency config:', currencyConfig);

    // Store selected currency in session
    ctx.session.selectedCoin = selectedCoin;
    ctx.session.step = "deposit_amount";

    // Ask for amount
    logger.info('[Deposit] Asking for amount');
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        `💵 Enter amount to deposit in ${currencyConfig.emoji} ${currencyConfig.name}:`,
        { reply_markup: new InlineKeyboard() }
    );
}

/**
 * Handles amount input in deposit flow
 */
export async function handleAmountInput(ctx: BotContext): Promise<void> {
    logger.info('[Deposit] Amount input received');
    
    if (!ctx.chat || !ctx.message?.text) {
        throw new Error("Invalid context for amount input");
    }

    const amount = parseFloat(ctx.message.text);
    logger.info('[Deposit] Parsed amount:', amount);

    if (isNaN(amount) || amount <= 0) {
        await ctx.reply(
            "❌ Invalid amount. Please try again.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    const selectedCoin = ctx.session.selectedCoin;
    if (!selectedCoin) {
        logger.error('[Deposit] No currency selected in session');
        await ctx.reply(
            "❌ No currency selected. Please start over.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    // Get user
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    logger.info('[Deposit] User:', user);

    // Create invoice
    logger.info('[Deposit] Creating invoice');
    const invoiceRepo = AppDataSource.getRepository(UserInvoice);
    const invoice = UserInvoice.create(user, amount, selectedCoin);
    logger.info('[Deposit] Invoice created:', invoice);
    
    await invoiceRepo.save(invoice);

    // Generate payment URL
    logger.info('[Deposit] Generating payment URL');
    const xrocketPay = XRocketPayService.getInstance();
    const { paymentUrl, invoiceId } = await xrocketPay.createInvoice(invoice);
    logger.info('[Deposit] XRocketPay response:', { paymentUrl, invoiceId });
    
    // Update invoice with payment details
    invoice.paymentUrl = paymentUrl;
    invoice.invoiceId = invoiceId;
    const savedInvoice = await invoiceRepo.save(invoice);
    logger.info('[Deposit] Invoice saved:', savedInvoice);

    // Store invoice ID in session
    ctx.session.invoiceId = invoiceId;
    ctx.session.step = undefined; // Clear step

    // Show invoice details
    logger.info('[Deposit] Showing invoice details');
    const detailMessage = userService.formatInvoiceDetailMessage(invoice);
    await ctx.reply(detailMessage, { reply_markup: createInvoiceDetailKeyboard(invoice) });
    logger.info('[Deposit] Deposit flow completed');
} 