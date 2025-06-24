import { BotContext } from "../../types/bot";
import { InlineKeyboard } from "grammy";
import { createMainMenuKeyboard } from "../keyboards/main";
import { createChequeDetailKeyboard } from "../keyboards/cheque";
import { UserService } from "../../services/user";
import { XRocketPayService } from "../../services/xrocket-pay";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatNumber } from "../utils/formatters";
import { AppDataSource } from "../../config/database";
import { UserCheque } from "../../entities/user-cheque";
import logger from "../../utils/logger";
import { ValidationService } from "../utils/validation";
import { ErrorHandler, ErrorType } from "../utils/error-handler";

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
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for multicheque flow");
        }

        // Answer the callback query
        await ctx.api.answerCallbackQuery(ctx.callbackQuery!.id);

        // Initialize session
        ctx.session.step = "multicheque_currency";
        ctx.session.selectedCoin = undefined;
        ctx.session.multichequeAmount = undefined;

        // Show currency selection
        logger.info('[Multicheque] Showing currency selection');
        await ctx.api.editMessageText(
            ctx.chat!.id,
            ctx.callbackQuery!.message!.message_id,
            "🎫 Choose currency for your cheque:",
            {
                reply_markup: createMultichequeCurrencyKeyboard()
            }
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'multicheque', 'flow_start');
    }
}

/**
 * Handles currency selection in multicheque flow
 */
export async function handleMultichequeCurrencySelection(ctx: BotContext): Promise<void> {
    logger.info('[Multicheque] Currency selection received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for currency selection");
        }

        // Use safe callback query answering
        await errorHandler.safeAnswerCallbackQuery(ctx);

        if (!ctx.callbackQuery!.data) {
            throw new Error("No callback data found");
        }

        const match = ctx.callbackQuery.data.match(/multicheque_currency_(.+)/);
        if (!match) {
            throw new Error("Invalid callback data format");
        }

        const selectedCoin = validationService.validateCurrency(match[1], "");
        logger.info('[Multicheque] Selected currency:', selectedCoin);

        // Validate currency
        if (!selectedCoin) {
            throw new Error("Invalid currency selected");
        }

        // Store currency in session
        ctx.session.selectedCoin = selectedCoin;
        ctx.session.step = "multicheque_amount";

        // Ask for amount
        logger.info('[Multicheque] Asking for amount');
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        await ctx.api.editMessageText(
            ctx.chat!.id,
            ctx.callbackQuery!.message!.message_id,
            `💰 Enter amount for your cheque:\n\nCurrency: ${currencyConfig.emoji} ${currencyConfig.name}`,
            { reply_markup: new InlineKeyboard() }
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'multicheque', 'currency_selection');
    }
}

/**
 * Handles amount input in multicheque flow
 */
export async function handleMultichequeAmountInput(ctx: BotContext): Promise<void> {
    logger.info('[Multicheque] Amount input received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    
    try {
        if (!validationService.validateMessageContext(ctx)) {
            throw new Error("Invalid context for amount input");
        }

        const amount = validationService.validateAmount(ctx.message!.text!);
        logger.info('[Multicheque] Parsed amount:', amount);

        if (!amount) {
            throw new Error("Invalid amount. Please enter a positive number.");
        }

        if (!validationService.validateSession(ctx, ['selectedCoin'])) {
            throw new Error("No currency selected. Please start over.");
        }

        const selectedCoin = ctx.session.selectedCoin!;

        // Get user
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        logger.info('[Multicheque] User:', user);

        // Check if user has sufficient balance
        const balanceValidation = await validationService.validateBalance(user, selectedCoin, amount);
        if (!balanceValidation.isValid) {
            throw new Error(balanceValidation.errorMessage!);
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
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'multicheque', 'amount_input');
    }
}

/**
 * Handles multicheque confirmation and execution
 */
export async function handleMultichequeConfirmation(ctx: BotContext): Promise<void> {
    logger.info('[Multicheque] Confirmation received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for multicheque confirmation");
        }

        // Use safe callback query answering
        await errorHandler.safeAnswerCallbackQuery(ctx);

        if (!validationService.validateSession(ctx, ['selectedCoin', 'multichequeAmount'])) {
            throw new Error("Session data missing. Please start over.");
        }

        const selectedCoin = ctx.session.selectedCoin!;
        const multichequeAmount = ctx.session.multichequeAmount!;

        // Get user
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        logger.info('[Multicheque] User:', user);

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
            ctx.chat!.id,
            ctx.callbackQuery!.message!.message_id,
            detailMessage,
            { reply_markup: createChequeDetailKeyboard(updatedCheque) }
        );

        logger.info('[Multicheque] Multicheque flow completed successfully');

    } catch (error) {
        // Handle API errors specifically
        if (error && typeof error === 'object' && 'response' in error) {
            await errorHandler.handleApiError(
                ctx, 
                error, 
                { conversation: 'multicheque', step: 'confirmation', action: 'cheque_creation' },
                ['step', 'selectedCoin', 'multichequeAmount']
            );
        } else {
            // Handle general conversation errors
            await errorHandler.handleConversationFlowError(ctx, error, 'multicheque', 'confirmation');
        }
    }
} 