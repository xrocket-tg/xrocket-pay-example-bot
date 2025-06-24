import { BotContext } from "../../types/bot";
import { AppDataSource } from "../../config/database";
import { UserInvoice } from "../../entities/user-invoice";
import { createCoinSelectionKeyboard } from "../keyboards/deposit";
import { UserService } from "../../services/user";
import { CurrencyConverter } from "../../types/currency";
import { InlineKeyboard } from "grammy";
import { XRocketPayService } from "../../services/xrocket-pay";
import logger from '../../utils/logger';
import { createInvoiceDetailKeyboard } from "../keyboards/invoices";
import { ValidationService } from "../utils/validation";
import { ErrorHandler, ErrorType } from "../utils/error-handler";
import { MessageService } from "../services/message-service";

/**
 * Handles the deposit flow using session-based state management
 */
export async function handleDepositFlow(ctx: BotContext): Promise<void> {
    logger.info('[Deposit] Starting deposit flow');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for deposit flow");
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
        await messageService.editMessage(
            ctx,
            "💱 Select currency for deposit:",
            createCoinSelectionKeyboard()
        );

        // Answer the callback query to remove loading state
        if (ctx.callbackQuery) {
            await errorHandler.safeAnswerCallbackQuery(ctx);
        }
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'deposit', 'flow_start');
    }
}

/**
 * Handles currency selection in deposit flow
 */
export async function handleCurrencySelection(ctx: BotContext): Promise<void> {
    logger.info('[Deposit] Currency selection received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for currency selection");
        }

        const selectedCoin = validationService.validateCurrency(ctx.callbackQuery!.data, "coin_");
        logger.info('[Deposit] Selected currency:', selectedCoin);
        
        // Use safe callback query answering
        await errorHandler.safeAnswerCallbackQuery(ctx);

        if (!selectedCoin) {
            throw new Error("Invalid currency selected");
        }

        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        logger.info('[Deposit] Currency config:', currencyConfig);

        // Store selected currency in session
        ctx.session.selectedCoin = selectedCoin;
        ctx.session.step = "deposit_amount";

        // Ask for amount
        logger.info('[Deposit] Asking for amount');
        await messageService.editMessage(
            ctx,
            `💵 Enter amount to deposit in ${currencyConfig.emoji} ${currencyConfig.name}:`,
            new InlineKeyboard()
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'deposit', 'currency_selection');
    }
}

/**
 * Handles amount input in deposit flow
 */
export async function handleAmountInput(ctx: BotContext): Promise<void> {
    logger.info('[Deposit] Amount input received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateMessageContext(ctx)) {
            throw new Error("Invalid context for amount input");
        }

        const amount = validationService.validateAmount(ctx.message!.text!);
        logger.info('[Deposit] Parsed amount:', amount);

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
        await messageService.editMessage(
            ctx,
            detailMessage,
            createInvoiceDetailKeyboard(invoice)
        );
        logger.info('[Deposit] Deposit flow completed');
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'deposit', 'amount_input');
    }
} 