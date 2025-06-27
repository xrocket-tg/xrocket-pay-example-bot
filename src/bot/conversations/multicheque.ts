import { BotContext } from "../../types/bot";
import { InlineKeyboard } from "grammy";
import { createMainMenuKeyboard } from "../keyboards/main";
import { createChequeDetailKeyboard } from "../keyboards/cheque";
import { UserService } from "../../services/user";
import { XRocketPayService } from "../../services/xrocket-pay";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatCurrency } from "../utils/formatters";
import { AppDataSource } from "../../config/database";
import { UserCheque } from "../../entities/user-cheque";
import logger from "../../utils/logger";
import { ValidationService } from "../utils/validation";
import { ErrorHandler, ErrorType } from "../utils/error-handler";
import { MessageService } from "../services/message-service";

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
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for multicheque flow");
        }

        // Answer the callback query
        await errorHandler.safeAnswerCallbackQuery(ctx);

        // Initialize session
        ctx.session.step = "multicheque_currency";
        ctx.session.selectedCoin = undefined;
        ctx.session.multichequeAmount = undefined;

        // Show currency selection
        logger.info('[Multicheque] Showing currency selection');
        await messageService.editMessage(
            ctx,
            ctx.t('multicheque-select-currency'),
            createMultichequeCurrencyKeyboard()
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
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for currency selection");
        }

        // Use safe callback query answering
        await errorHandler.safeAnswerCallbackQuery(ctx);

        if (!ctx.callbackQuery?.data) {
            throw new Error("Invalid callback data");
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
        await messageService.editMessage(
            ctx,
            ctx.t('multicheque-enter-amount', {
                emoji: currencyConfig.emoji,
                name: currencyConfig.name
            }),
            new InlineKeyboard()
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
    const messageService = MessageService.getInstance();
    
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
        const confirmationMessage = ctx.t('multicheque-confirm-multicheque', {
            amount: formatCurrency(amount),
            emoji: currencyConfig.emoji,
            name: currencyConfig.name
        });

        const keyboard = new InlineKeyboard()
            .text(ctx.t('buttons-confirm'), "confirm_multicheque")
            .row()
            .text(ctx.t('buttons-cancel'), "main_menu");

        await messageService.editMessage(ctx, confirmationMessage, keyboard);
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
    const messageService = MessageService.getInstance();
    
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
        const amount = ctx.session.multichequeAmount!;

        // Get user
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        logger.info('[Multicheque] User:', user);

        // Check if user has sufficient balance
        const balanceValidation = await validationService.validateBalance(user, selectedCoin, amount);
        if (!balanceValidation.isValid) {
            throw new Error(balanceValidation.errorMessage!);
        }

        // Create cheque record
        logger.info('[Multicheque] Creating cheque record');
        const chequeRepo = AppDataSource.getRepository(UserCheque);
        const cheque = UserCheque.create(user, amount, selectedCoin, 1);
        const savedCheque = await chequeRepo.save(cheque);
        logger.info('[Multicheque] Cheque record created:', savedCheque);

        // Create multicheque via XRocketPay
        logger.info('[Multicheque] Creating multicheque via XRocketPay');
        const xrocketPay = XRocketPayService.getInstance();
        const { chequeId, link } = await xrocketPay.createMulticheque(cheque);
        logger.info('[Multicheque] XRocketPay response:', { chequeId, link });

        // Update cheque with payment details
        savedCheque.chequeId = chequeId;
        savedCheque.link = link;
        const updatedCheque = await chequeRepo.save(savedCheque);
        logger.info('[Multicheque] Cheque updated:', updatedCheque);

        // Clear session
        ctx.session.selectedCoin = undefined;
        ctx.session.multichequeAmount = undefined;
        ctx.session.step = undefined;

        // Show success message
        logger.info('[Multicheque] Showing success message');
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        const successMessage = ctx.t('multicheque-multicheque-success', {
            amount: formatCurrency(amount),
            emoji: currencyConfig.emoji,
            name: currencyConfig.name,
            chequeId: chequeId,
            link: link
        });

        await messageService.editMessage(ctx, successMessage, createChequeDetailKeyboard(updatedCheque, ctx));
        logger.info('[Multicheque] Multicheque flow completed');
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'multicheque', 'confirmation');
    }
} 