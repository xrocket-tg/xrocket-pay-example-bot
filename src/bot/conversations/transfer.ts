import { BotContext } from "../../types/bot";
import { AppDataSource } from "../../config/database";
import { UserTransfer } from "../../entities/user-transfer";
import { createTransferCurrencyKeyboard } from "../keyboards/transfer";
import { createMainMenuKeyboard } from "../keyboards/main";
import { formatNumber } from "../utils/formatters";
import { UserService } from "../../services/user";
import { XRocketPayService } from "../../services/xrocket-pay";
import { CURRENCIES, CurrencyConverter, InternalCurrency } from "../../types/currency";
import { InlineKeyboard } from "grammy";
import logger from '../../utils/logger';

/**
 * Handles the transfer flow using session-based state management
 */
export async function handleTransferFlow(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Starting transfer flow');
    
    if (!ctx.chat) {
        throw new Error("Chat context not found");
    }

    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    logger.info('[Transfer] User:', user);
    
    // Get message ID from callback query
    const messageId = ctx.callbackQuery?.message?.message_id;
    logger.info('[Transfer] Message ID:', messageId);

    if (!messageId) {
        logger.error('[Transfer] No message ID found');
        throw new Error("Message ID not found");
    }

    // Show currency selection
    logger.info('[Transfer] Showing currency selection');
    await ctx.api.editMessageText(
        ctx.chat.id,
        messageId,
        "💱 Select currency for transfer:",
        { reply_markup: createTransferCurrencyKeyboard() }
    );

    // Answer the callback query to remove loading state
    if (ctx.callbackQuery) {
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);
    }
}

/**
 * Handles currency selection in transfer flow
 */
export async function handleTransferCurrencySelection(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Currency selection received');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for currency selection");
    }

    const selectedCoin = ctx.callbackQuery.data?.replace("transfer_coin_", "") as InternalCurrency;
    logger.info('[Transfer] Selected currency:', selectedCoin);
    
    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    if (!selectedCoin || !CurrencyConverter.isSupportedInternal(selectedCoin)) {
        logger.error('[Transfer] Invalid currency selected:', selectedCoin);
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            "❌ Invalid currency selected. Please try again.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    logger.info('[Transfer] Currency config:', currencyConfig);

    // Store selected currency in session
    ctx.session.selectedCoin = selectedCoin;
    ctx.session.step = "transfer_amount";

    // Ask for amount
    logger.info('[Transfer] Asking for amount');
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        `💵 Enter amount to transfer in ${currencyConfig.emoji} ${currencyConfig.name}:`,
        { reply_markup: new InlineKeyboard() }
    );
}

/**
 * Handles amount input in transfer flow
 */
export async function handleTransferAmountInput(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Amount input received');
    
    if (!ctx.chat || !ctx.message?.text) {
        throw new Error("Invalid context for amount input");
    }

    const amount = parseFloat(ctx.message.text);
    logger.info('[Transfer] Parsed amount:', amount);
    logger.info('[Transfer] Current session before storing amount:', {
        step: ctx.session.step,
        selectedCoin: ctx.session.selectedCoin,
        transferAmount: ctx.session.transferAmount
    });

    if (isNaN(amount) || amount <= 0) {
        await ctx.reply(
            "❌ Invalid amount. Please try again.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    const selectedCoin = ctx.session.selectedCoin;
    if (!selectedCoin) {
        logger.error('[Transfer] No currency selected in session');
        await ctx.reply(
            "❌ No currency selected. Please start over.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    // Get user
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    logger.info('[Transfer] User:', user);

    // Check if user has sufficient balance
    const balance = await userService.getUserBalance(user, selectedCoin);
    if (!balance || balance.amount < amount) {
        const availableAmount = balance ? balance.amount : 0;
        await ctx.reply(
            `❌ Insufficient balance. You have ${formatNumber(availableAmount)} ${selectedCoin}, but trying to transfer ${formatNumber(amount)} ${selectedCoin}.`,
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    // Store amount in session
    ctx.session.transferAmount = amount;
    ctx.session.step = "transfer_recipient";
    
    logger.info('[Transfer] Session after storing amount:', {
        step: ctx.session.step,
        selectedCoin: ctx.session.selectedCoin,
        transferAmount: ctx.session.transferAmount
    });

    // Ask for recipient ID
    logger.info('[Transfer] Asking for recipient ID');
    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    const formattedAmount = formatNumber(amount);
    logger.info('[Transfer] Amount formatting:', {
        originalAmount: amount,
        formattedAmount: formattedAmount,
        amountType: typeof amount
    });
    await ctx.reply(
        `👤 Enter recipient's Telegram ID:\n\nYour Telegram ID: ${ctx.from?.id}\n\nAmount: ${amount} ${currencyConfig.emoji} ${currencyConfig.name}`,
        { reply_markup: new InlineKeyboard() }
    );
}

/**
 * Handles recipient ID input in transfer flow
 */
export async function handleTransferRecipientInput(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Recipient input received');
    
    if (!ctx.chat || !ctx.message?.text) {
        throw new Error("Invalid context for recipient input");
    }

    const recipientId = parseInt(ctx.message.text);
    logger.info('[Transfer] Parsed recipient ID:', recipientId);

    if (isNaN(recipientId) || recipientId <= 0) {
        await ctx.reply(
            "❌ Invalid Telegram ID. Please enter a valid number.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    const selectedCoin = ctx.session.selectedCoin;
    const transferAmount = ctx.session.transferAmount;
    
    logger.info('[Transfer] Session data in recipient handler:', {
        step: ctx.session.step,
        selectedCoin: ctx.session.selectedCoin,
        transferAmount: ctx.session.transferAmount
    });
    
    if (!selectedCoin || !transferAmount) {
        logger.error('[Transfer] Missing session data');
        await ctx.reply(
            "❌ Session data missing. Please start over.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    // Validate recipient ID format
    const xrocketPay = XRocketPayService.getInstance();
    const isValidRecipient = await xrocketPay.validateTelegramId(recipientId);
    if (!isValidRecipient) {
        await ctx.reply(
            "❌ Invalid Telegram ID format. Please enter a valid Telegram user ID.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }

    // Store recipient ID in session
    ctx.session.recipientId = recipientId;
    ctx.session.step = "transfer_confirmation";

    // Show confirmation
    logger.info('[Transfer] Showing confirmation');
    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    const confirmationMessage = `📤 Transfer Confirmation\n\n` +
        `💰 Amount: ${formatNumber(transferAmount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
        `👤 Recipient ID: ${recipientId}\n\n` +
        `Are you sure you want to proceed?`;

    const keyboard = new InlineKeyboard()
        .text("✅ Confirm Transfer", "confirm_transfer")
        .row()
        .text("❌ Cancel", "main_menu");

    await ctx.reply(confirmationMessage, { reply_markup: keyboard });
}

/**
 * Handles transfer confirmation and execution
 */
export async function handleTransferConfirmation(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Confirmation received');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for transfer confirmation");
    }

    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    const selectedCoin = ctx.session.selectedCoin;
    const transferAmount = ctx.session.transferAmount;
    const recipientId = ctx.session.recipientId;
    
    logger.info('[Transfer] Session data in confirmation handler:', {
        step: ctx.session.step,
        selectedCoin: ctx.session.selectedCoin,
        transferAmount: ctx.session.transferAmount,
        recipientId: ctx.session.recipientId
    });
    
    if (!selectedCoin || !transferAmount || !recipientId) {
        logger.error('[Transfer] Missing session data for confirmation');
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
    logger.info('[Transfer] User:', user);

    try {
        // Create transfer record
        logger.info('[Transfer] Creating transfer record');
        const transferRepo = AppDataSource.getRepository(UserTransfer);
        const transfer = UserTransfer.create(
            user,
            recipientId,
            null, // recipient username (we don't have it)
            transferAmount,
            selectedCoin
        );
        
        const savedTransfer = await transferRepo.save(transfer);
        logger.info('[Transfer] Transfer record created:', savedTransfer);

        // Execute transfer via xRocket Pay
        logger.info('[Transfer] Executing transfer via xRocket Pay');
        const xrocketPay = XRocketPayService.getInstance();
        const result = await xrocketPay.createTransfer(savedTransfer);
        logger.info('[Transfer] xRocket Pay transfer result:', result);

        // Update user balance (subtract amount)
        logger.info('[Transfer] Updating sender balance');
        await userService.updateBalance(user, selectedCoin, -transferAmount);

        // Clear session
        ctx.session.step = undefined;
        ctx.session.selectedCoin = undefined;
        ctx.session.transferAmount = undefined;
        ctx.session.recipientId = undefined;

        // Show success message
        logger.info('[Transfer] Showing success message');
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        const successMessage = `✅ Transfer completed successfully!\n\n` +
            `💰 Amount: ${formatNumber(transferAmount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
            `👤 Recipient ID: ${recipientId}\n` +
            `🆔 Transfer ID: ${result.transferId}`;

        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            successMessage,
            { reply_markup: createMainMenuKeyboard() }
        );

        logger.info('[Transfer] Transfer flow completed successfully');

    } catch (error) {
        // Log only essential error data
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as any;
            logger.error('[Transfer] Error during transfer:', {
                status: axiosError.response?.status,
                data: axiosError.response?.data,
                errors: axiosError.response?.data?.errors
            });
        } else {
            logger.error('[Transfer] Error during transfer:', error instanceof Error ? error.message : 'Unknown error');
        }
        
        // Clear session
        ctx.session.step = undefined;
        ctx.session.selectedCoin = undefined;
        ctx.session.transferAmount = undefined;
        ctx.session.recipientId = undefined;

        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            `❌ Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { reply_markup: createMainMenuKeyboard() }
        );
    }
} 