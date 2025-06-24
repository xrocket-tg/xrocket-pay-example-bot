import { BotContext } from "../../types/bot";
import { AppDataSource } from "../../config/database";
import { UserTransfer } from "../../entities/user-transfer";
import { createTransferCurrencyKeyboard } from "../keyboards/transfer";
import { createMainMenuKeyboard } from "../keyboards/main";
import { formatNumber } from "../utils/formatters";
import { UserService } from "../../services/user";
import { XRocketPayService } from "../../services/xrocket-pay";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { InlineKeyboard } from "grammy";
import logger from '../../utils/logger';
import { TransactionService } from "../../services/transaction";
import { ValidationService } from "../utils/validation";
import { ErrorHandler, ErrorType } from "../utils/error-handler";
import { MessageService } from "../services/message-service";

/**
 * Handles the transfer flow using session-based state management
 */
export async function handleTransferFlow(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Starting transfer flow');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for transfer flow");
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
        await messageService.editMessage(
            ctx,
            "💱 Select currency for transfer:",
            createTransferCurrencyKeyboard()
        );

        // Answer the callback query to remove loading state
        if (ctx.callbackQuery) {
            await errorHandler.safeAnswerCallbackQuery(ctx);
        }
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'transfer', 'flow_start');
    }
}

/**
 * Handles currency selection in transfer flow
 */
export async function handleTransferCurrencySelection(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Currency selection received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for currency selection");
        }

        const selectedCoin = validationService.validateCurrency(ctx.callbackQuery!.data, "transfer_coin_");
        logger.info('[Transfer] Selected currency:', selectedCoin);
        
        // Use safe callback query answering
        await errorHandler.safeAnswerCallbackQuery(ctx);

        if (!selectedCoin) {
            throw new Error("Invalid currency selected");
        }

        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        logger.info('[Transfer] Currency config:', currencyConfig);

        // Store selected currency in session
        ctx.session.selectedCoin = selectedCoin;
        ctx.session.step = "transfer_amount";

        // Ask for amount
        logger.info('[Transfer] Asking for amount');
        await messageService.editMessage(
            ctx,
            `💵 Enter amount to transfer in ${currencyConfig.emoji} ${currencyConfig.name}:`,
            new InlineKeyboard()
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'transfer', 'currency_selection');
    }
}

/**
 * Handles amount input in transfer flow
 */
export async function handleTransferAmountInput(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Amount input received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateMessageContext(ctx)) {
            throw new Error("Invalid context for amount input");
        }

        const amount = validationService.validateAmount(ctx.message!.text!);
        logger.info('[Transfer] Parsed amount:', amount);
        logger.info('[Transfer] Current session before storing amount:', {
            step: ctx.session.step,
            selectedCoin: ctx.session.selectedCoin,
            transferAmount: ctx.session.transferAmount
        });

        if (!amount) {
            throw new Error("Invalid amount. Please try again.");
        }

        if (!validationService.validateSession(ctx, ['selectedCoin'])) {
            throw new Error("No currency selected. Please start over.");
        }

        const selectedCoin = ctx.session.selectedCoin!;

        // Get user
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        logger.info('[Transfer] User:', user);

        // Check if user has sufficient balance
        const balanceValidation = await validationService.validateBalance(user, selectedCoin, amount);
        if (!balanceValidation.isValid) {
            throw new Error(balanceValidation.errorMessage!);
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
        await messageService.editMessage(
            ctx,
            `👤 Enter recipient's Telegram ID:\n\nYour Telegram ID: ${ctx.from?.id}\n\nAmount: ${amount} ${currencyConfig.emoji} ${currencyConfig.name}`,
            new InlineKeyboard()
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'transfer', 'amount_input');
    }
}

/**
 * Handles recipient ID input in transfer flow
 */
export async function handleTransferRecipientInput(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Recipient input received');
    
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    if (!validationService.validateMessageContext(ctx)) {
        throw new Error("Invalid context for recipient input");
    }

    const recipientId = validationService.validateTelegramId(ctx.message!.text!);
    logger.info('[Transfer] Parsed recipient ID:', recipientId);

    if (!recipientId) {
        await messageService.showError(
            ctx,
            "Invalid Telegram ID. Please enter a valid number."
        );
        return;
    }

    if (!validationService.validateSession(ctx, ['selectedCoin', 'transferAmount'])) {
        logger.error('[Transfer] Missing session data');
        await messageService.showError(
            ctx,
            "Session data missing. Please start over."
        );
        return;
    }

    const selectedCoin = ctx.session.selectedCoin!;
    const amount = ctx.session.transferAmount!;

    // Get user
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    logger.info('[Transfer] User:', user);

    // Check if user has sufficient balance
    const balanceValidation = await validationService.validateBalance(user, selectedCoin, amount);
    if (!balanceValidation.isValid) {
        await messageService.showError(ctx, balanceValidation.errorMessage!);
        return;
    }

    // Store recipient ID in session
    ctx.session.transferRecipientId = recipientId;
    ctx.session.step = "transfer_confirmation";

    // Show confirmation
    logger.info('[Transfer] Showing confirmation');
    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    const confirmationMessage = `📋 Transfer Confirmation\n\n` +
        `💰 Amount: ${formatNumber(amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
        `👤 Recipient ID: ${recipientId}\n\n` +
        `Please confirm the transfer:`;

    const keyboard = new InlineKeyboard()
        .text("✅ Confirm Transfer", "confirm_transfer")
        .text("❌ Cancel", "main_menu");

    await messageService.editMessage(ctx, confirmationMessage, keyboard);
}

/**
 * Handles transfer confirmation
 */
export async function handleTransferConfirmation(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Transfer confirmation received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for transfer confirmation");
        }

        // Use safe callback query answering
        await errorHandler.safeAnswerCallbackQuery(ctx);

        if (!validationService.validateSession(ctx, ['selectedCoin', 'transferAmount', 'transferRecipientId'])) {
            throw new Error("Missing transfer data. Please start over.");
        }

        const selectedCoin = ctx.session.selectedCoin!;
        const amount = ctx.session.transferAmount!;
        const recipientId = ctx.session.transferRecipientId!;

        // Get user
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        logger.info('[Transfer] User:', user);

        // Check if user has sufficient balance
        const balanceValidation = await validationService.validateBalance(user, selectedCoin, amount);
        if (!balanceValidation.isValid) {
            throw new Error(balanceValidation.errorMessage!);
        }

        // Execute transfer
        logger.info('[Transfer] Executing transfer');
        const transactionService = TransactionService.getInstance();
        const transfer = await transactionService.executeTransfer(user, selectedCoin, amount, recipientId);
        logger.info('[Transfer] Transfer executed:', transfer);

        // Clear session
        ctx.session.selectedCoin = undefined;
        ctx.session.transferAmount = undefined;
        ctx.session.transferRecipientId = undefined;
        ctx.session.step = undefined;

        // Show success message
        logger.info('[Transfer] Showing success message');
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        const successMessage = `✅ Transfer completed successfully!\n\n` +
            `💰 Amount: ${formatNumber(amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
            `👤 Recipient ID: ${recipientId}\n` +
            `🆔 Transfer ID: ${transfer.id}`;

        await messageService.showSuccess(ctx, successMessage, createMainMenuKeyboard());
        logger.info('[Transfer] Transfer flow completed');
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'transfer', 'confirmation');
    }
} 