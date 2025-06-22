import { BotContext } from "../../types/bot";
import { InlineKeyboard } from "grammy";
import { createMainMenuKeyboard } from "../keyboards/main";
import { createChequeDetailKeyboard } from "../keyboards/cheque";
import { UserService } from "../../services/user";
import { XRocketPayService } from "../../services/xrocket-pay";
import { CurrencyConverter, InternalCurrency, CURRENCIES } from "../../types/currency";
import { formatNumber } from "../utils/formatters";
import { AppDataSource } from "../../config/database";
import { UserCheque } from "../../entities/user-cheque";
import logger from "../../utils/logger";

/**
 * Creates inline keyboard for multicheque currency selection
 */
function createMultichequeCurrencyKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const codes = CurrencyConverter.getSupportedInternalCodes();
    codes.forEach((code, idx) => {
        const config = CurrencyConverter.getConfig(code);
        keyboard.text(`${config.emoji} ${config.name}`, `multicheque_currency_${code}`);
        if ((idx + 1) % 2 === 0 && idx !== codes.length - 1) {
            keyboard.row();
        }
    });
    return keyboard;
}

/**
 * Handles the multicheque flow initiation
 */
export async function handleMultichequeFlow(ctx: BotContext): Promise<void> {
    logger.info('[Multicheque] Starting multicheque flow');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for multicheque flow");
    }

    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    // Initialize session
    ctx.session.step = "multicheque_currency";
    ctx.session.selectedCoin = undefined;
    ctx.session.multichequeAmount = undefined;

    // Show currency selection
    logger.info('[Multicheque] Showing currency selection');
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        "🎫 Choose currency for your cheque:",
        {
            reply_markup: createMultichequeCurrencyKeyboard()
        }
    );
}

/**
 * Handles currency selection in multicheque flow
 */
export async function handleMultichequeCurrencySelection(ctx: BotContext): Promise<void> {
    logger.info('[Multicheque] Currency selection received');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for currency selection");
    }

    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    if (!ctx.callbackQuery.data) {
        logger.error('[Multicheque] No callback data found');
        return;
    }

    const match = ctx.callbackQuery.data.match(/multicheque_currency_(.+)/);
    if (!match) {
        logger.error('[Multicheque] Invalid callback data format');
        return;
    }

    const selectedCoin = match[1] as InternalCurrency;
    logger.info('[Multicheque] Selected currency:', selectedCoin);

    // Validate currency
    if (!CurrencyConverter.isSupportedInternal(selectedCoin)) {
        logger.error('[Multicheque] Invalid currency:', selectedCoin);
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            "❌ Invalid currency selected. Please try again.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    // Store currency in session
    ctx.session.selectedCoin = selectedCoin;
    ctx.session.step = "multicheque_amount";

    // Ask for amount
    logger.info('[Multicheque] Asking for amount');
    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        `💰 Enter amount for your cheque:\n\nCurrency: ${currencyConfig.emoji} ${currencyConfig.name}`,
        { reply_markup: new InlineKeyboard() }
    );
}

/**
 * Handles amount input in multicheque flow
 */
export async function handleMultichequeAmountInput(ctx: BotContext): Promise<void> {
    logger.info('[Multicheque] Amount input received');
    
    if (!ctx.chat || !ctx.message?.text) {
        throw new Error("Invalid context for amount input");
    }

    const amount = parseFloat(ctx.message.text);
    logger.info('[Multicheque] Parsed amount:', amount);

    if (isNaN(amount) || amount <= 0) {
        await ctx.reply(
            "❌ Invalid amount. Please enter a positive number.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    const selectedCoin = ctx.session.selectedCoin;
    if (!selectedCoin) {
        logger.error('[Multicheque] No currency selected in session');
        await ctx.reply(
            "❌ No currency selected. Please start over.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    // Get user
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    logger.info('[Multicheque] User:', user);

    // Check if user has sufficient balance
    const balance = await userService.getUserBalance(user, selectedCoin);
    if (!balance || balance.amount < amount) {
        const availableAmount = balance ? balance.amount : 0;
        await ctx.reply(
            `❌ Insufficient balance. You have ${formatNumber(availableAmount)} ${selectedCoin}, but trying to create multicheque for ${formatNumber(amount)} ${selectedCoin}.`,
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    // Store amount in session
    ctx.session.multichequeAmount = amount;
    ctx.session.step = "multicheque_confirmation";

    // Show confirmation
    logger.info('[Multicheque] Showing confirmation');
    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    const confirmationMessage = `🎫 Cheque Confirmation\n\n` +
        `💰 Amount: ${amount} ${currencyConfig.emoji} ${currencyConfig.name}\n\n` +
        `Are you sure you want to create this cheque?`;

    const keyboard = new InlineKeyboard()
        .text("✅ Create Cheque", "confirm_multicheque")
        .row()
        .text("❌ Cancel", "main_menu");

    await ctx.reply(confirmationMessage, { reply_markup: keyboard });
}

/**
 * Handles multicheque confirmation and execution
 */
export async function handleMultichequeConfirmation(ctx: BotContext): Promise<void> {
    logger.info('[Multicheque] Confirmation received');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for multicheque confirmation");
    }

    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    const selectedCoin = ctx.session.selectedCoin;
    const multichequeAmount = ctx.session.multichequeAmount;
    
    if (!selectedCoin || !multichequeAmount) {
        logger.error('[Multicheque] Missing session data for confirmation');
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            "❌ Session data missing. Please start over.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    // Get user
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    logger.info('[Multicheque] User:', user);

    try {
        // Create cheque record
        logger.info('[Multicheque] Creating cheque record');
        const chequeRepo = AppDataSource.getRepository(UserCheque);
        const cheque = UserCheque.create(
            user,
            multichequeAmount,
            selectedCoin,
            1 // Single user cheque
        );
        
        const savedCheque = await chequeRepo.save(cheque);
        logger.info('[Multicheque] Cheque record created:', savedCheque);

        // Execute multicheque creation via xRocket Pay
        logger.info('[Multicheque] Creating multicheque via xRocket Pay');
        const xrocketPay = XRocketPayService.getInstance();
        const result = await xrocketPay.createMulticheque(savedCheque);
        logger.info('[Multicheque] xRocket Pay multicheque result:', result);

        // Update user balance (subtract amount)
        logger.info('[Multicheque] Updating user balance');
        await userService.updateBalance(user, selectedCoin, -multichequeAmount);

        // Reload cheque to get updated data
        const updatedCheque = await chequeRepo.findOne({ 
            where: { id: savedCheque.id },
            relations: ['user']
        });
        
        if (!updatedCheque) {
            throw new Error('Failed to reload cheque data');
        }

        // Clear session
        ctx.session.step = undefined;
        ctx.session.selectedCoin = undefined;
        ctx.session.multichequeAmount = undefined;

        // Show cheque details page
        logger.info('[Multicheque] Showing cheque details');
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        const detailMessage = `🎫 Cheque Details\n\n` +
            `💰 Amount: ${multichequeAmount} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
            `👥 Users: 1\n` +
            `🆔 Cheque ID: ${result.chequeId}\n` +
            `📅 Created: ${updatedCheque.createdAt.toLocaleDateString()}\n\n` +
            `🔗 Cheque Link:\n${result.link}`;

        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            detailMessage,
            { reply_markup: createChequeDetailKeyboard(updatedCheque) }
        );

        logger.info('[Multicheque] Multicheque flow completed successfully');

    } catch (error) {
        // Log only the relevant error data
        if (error && typeof error === 'object' && 'response' in error) {
            const errorResponse = error.response as any;
            if (errorResponse?.data) {
                logger.error('[Multicheque] Error during multicheque creation:', {
                    data: errorResponse.data,
                    errors: errorResponse.data.errors
                });
            } else {
                logger.error('[Multicheque] Error during multicheque creation:', error);
            }
        } else {
            logger.error('[Multicheque] Error during multicheque creation:', error);
        }
        
        // Clear session
        ctx.session.step = undefined;
        ctx.session.selectedCoin = undefined;
        ctx.session.multichequeAmount = undefined;

        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            `❌ Cheque creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { reply_markup: createMainMenuKeyboard() }
        );
    }
} 