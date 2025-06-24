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

/**
 * EXAMPLE: Refactored transfer conversation using ErrorHandler
 * This demonstrates how much cleaner error handling becomes
 */

/**
 * Handles transfer confirmation and execution (REFACTORED WITH ERROR HANDLER)
 */
export async function handleTransferConfirmationWithErrorHandler(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Confirmation received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for transfer confirmation");
        }

        // Answer the callback query
        await ctx.api.answerCallbackQuery(ctx.callbackQuery!.id);

        if (!validationService.validateSession(ctx, ['selectedCoin', 'transferAmount', 'recipientId'])) {
            throw new Error("Session data missing. Please start over.");
        }

        const selectedCoin = ctx.session.selectedCoin!;
        const transferAmount = ctx.session.transferAmount!;
        const recipientId = ctx.session.recipientId!;
        
        logger.info('[Transfer] Session data in confirmation handler:', {
            step: ctx.session.step,
            selectedCoin: ctx.session.selectedCoin,
            transferAmount: ctx.session.transferAmount,
            recipientId: ctx.session.recipientId
        });

        // Get user
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        logger.info('[Transfer] User:', user);

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

        // Execute transfer via TransactionService (ensures transaction safety)
        logger.info('[Transfer] Executing transfer via TransactionService');
        const transactionService = TransactionService.getInstance();
        const result = await transactionService.processTransfer(savedTransfer);
        logger.info('[Transfer] TransactionService transfer result:', result);

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
            ctx.chat!.id,
            ctx.callbackQuery!.message!.message_id,
            successMessage,
            { reply_markup: createMainMenuKeyboard() }
        );

        logger.info('[Transfer] Transfer flow completed successfully');

    } catch (error) {
        // Handle API errors specifically
        if (error && typeof error === 'object' && 'response' in error) {
            await errorHandler.handleApiError(
                ctx, 
                error, 
                { conversation: 'transfer', step: 'confirmation', action: 'transfer_execution' },
                ['step', 'selectedCoin', 'transferAmount', 'recipientId']
            );
        } else {
            // Handle general conversation errors
            await errorHandler.handleConversationFlowError(ctx, error, 'transfer', 'confirmation');
        }
    }
}

/**
 * Handles amount input in transfer flow (REFACTORED WITH ERROR HANDLER)
 */
export async function handleTransferAmountInputWithErrorHandler(ctx: BotContext): Promise<void> {
    logger.info('[Transfer] Amount input received');
    
    const validationService = ValidationService.getInstance();
    const errorHandler = ErrorHandler.getInstance();
    
    try {
        if (!validationService.validateMessageContext(ctx)) {
            throw new Error("Invalid context for amount input");
        }

        const amount = validationService.validateAmount(ctx.message!.text!);
        logger.info('[Transfer] Parsed amount:', amount);

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
        await ctx.reply(
            `👤 Enter recipient's Telegram ID:\n\nYour Telegram ID: ${ctx.from?.id}\n\nAmount: ${amount} ${currencyConfig.emoji} ${currencyConfig.name}`,
            { reply_markup: new InlineKeyboard() }
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'transfer', 'amount_input');
    }
}

/**
 * COMPARISON: Original vs Refactored error handling
 * 
 * ORIGINAL ERROR HANDLING (repeated in every conversation):
 * ```typescript
 * } catch (error) {
 *     // Log only essential error data
 *     if (error && typeof error === 'object' && 'response' in error) {
 *         const axiosError = error as any;
 *         logger.error('[Transfer] Error during transfer:', {
 *             status: axiosError.response?.status,
 *             data: axiosError.response?.data,
 *             errors: axiosError.response?.data?.errors
 *         });
 *     } else {
 *         logger.error('[Transfer] Error during transfer:', error instanceof Error ? error.message : 'Unknown error');
 *     }
 *     
 *     // Clear session
 *     ctx.session.step = undefined;
 *     ctx.session.selectedCoin = undefined;
 *     ctx.session.transferAmount = undefined;
 *     ctx.session.recipientId = undefined;
 * 
 *     await ctx.api.editMessageText(
 *         ctx.chat!.id,
 *         ctx.callbackQuery!.message!.message_id,
 *         `❌ Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
 *         { reply_markup: createMainMenuKeyboard() }
 *     );
 * }
 * ```
 * 
 * REFACTORED ERROR HANDLING:
 * ```typescript
 * } catch (error) {
 *     if (error && typeof error === 'object' && 'response' in error) {
 *         await errorHandler.handleApiError(ctx, error, context, sessionFields);
 *     } else {
 *         await errorHandler.handleConversationFlowError(ctx, error, 'transfer', 'confirmation');
 *     }
 * }
 * ```
 * 
 * BENEFITS:
 * 1. Consistent error handling across all conversations
 * 2. Centralized error logging with proper context
 * 3. Automatic session clearing
 * 4. User-friendly error messages
 * 5. Better debugging capabilities
 * 6. Reduced code duplication by ~80%
 * 7. Easier to maintain and update error handling logic
 */ 