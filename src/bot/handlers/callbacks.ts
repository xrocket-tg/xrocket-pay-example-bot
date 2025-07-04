import { UserService } from "../../services/user";
import { BotContext } from "../../types/bot";
import { createMainMenuKeyboard, createWithdrawMenuKeyboard } from "../keyboards/main";
import { createCoinSelectionKeyboard } from "../keyboards/deposit";
import { createInvoicesKeyboard } from "../keyboards/invoices";
import { createInvoiceDetailKeyboard } from "../keyboards/invoices";
import { handleCurrencySelection, handleAmountInput } from "../conversations/deposit";
import { AppDataSource } from "../../config/database";
import { UserInvoice } from "../../entities/user-invoice";
import { XRocketPayService } from "../../services/xrocket-pay";
import logger from "../../utils/logger";
import { handleTransferFlow } from "../conversations/transfer";
import { handleMultichequeFlow } from "../conversations/multicheque";
import { UserCheque } from "../../entities/user-cheque";
import { handleExternalWithdrawalFlow } from "../conversations/external-withdrawal";
import { createWithdrawalDetailKeyboard, createWithdrawalsKeyboard, createWithdrawalHistoryMenuKeyboard } from "../keyboards/withdrawal";
import { UserWithdrawal } from "../../entities/user-withdrawal";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { createTransfersKeyboard, createTransferDetailKeyboard } from "../keyboards/transfer";
import { createChequesKeyboard, createChequeDetailKeyboard } from "../keyboards/cheque";
import { UserTransfer } from "../../entities/user-transfer";
import { formatCurrency, formatDate } from "../utils/formatters";
import { ValidationService } from "../utils/validation";
import { ErrorHandler, ErrorType } from "../utils/error-handler";
import { MessageService } from "../services/message-service";

const errorHandler = ErrorHandler.getInstance();

/**
 * Handles the main menu balance display
 */
export async function handleBalance(ctx: BotContext): Promise<void> {
    try {
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        await userService.displayBalance(ctx, user);
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'balance', 'display');
    }
}

/**
 * Handles the deposit button click
 */
export async function handleDeposit(ctx: BotContext): Promise<void> {
    try {
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        await userService.displayBalance(ctx, user);
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'deposit', 'button_click');
    }
}

/**
 * Handles the main menu button click
 */
export async function handleMainMenu(ctx: BotContext): Promise<void> {
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    const userService = UserService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for main menu");
        }
        
        const user = await userService.findOrCreateUser(ctx);
        const balances = await userService.getUserBalances(user);
        const balanceMessage = userService.formatBalanceMessage(balances, ctx);

        // Show welcome message with balance
        const welcomeMessage = ctx.t('main-welcome') + '\n\n' + balanceMessage;

        await messageService.editMessage(
            ctx,
            welcomeMessage,
            createMainMenuKeyboard(ctx),
            { disableWebPagePreview: true, parseMode: 'HTML' }
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'main_menu', 'button_click');
    }
}

/**
 * Handles the withdraw button click (shows withdraw submenu)
 */
export async function handleWithdraw(ctx: BotContext): Promise<void> {
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for withdraw");
        }
        
        await messageService.editMessage(
            ctx,
            ctx.t('withdrawal-select-type'),
            createWithdrawMenuKeyboard(ctx)
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'withdraw', 'button_click');
    }
}

/**
 * Handles the my withdrawals button click - shows withdrawal history menu
 */
export async function handleMyWithdrawals(ctx: BotContext): Promise<void> {
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for my withdrawals");
        }
        
        await messageService.editMessage(
            ctx,
            ctx.t('withdrawals-select-type'),
            createWithdrawalHistoryMenuKeyboard(ctx)
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'my_withdrawals', 'button_click');
    }
}

/**
 * Handles the my invoices button click
 */
export async function handleInvoices(ctx: BotContext): Promise<void> {
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for invoices");
        }
        
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        
        const result = await userService.getUserInvoicesWithPagination(user, 0, 5, ctx);
        
        await messageService.editMessage(
            ctx,
            result.message,
            createInvoicesKeyboard(result.invoices, result.allInvoices.length, 0, ctx)
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'invoices', 'button_click');
    }
}

/**
 * Handles invoice pagination
 */
export async function handleInvoicePagination(ctx: BotContext): Promise<void> {
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContextWithData(ctx)) {
            throw new Error("Invalid context for invoice pagination");
        }

        const match = ctx.callbackQuery!.data!.match(/invoices_page_(\d+)/);
        if (!match) {
            throw new Error("Invalid pagination data format");
        }

        const page = validationService.validatePositiveNumber(parseInt(match[1])) ? parseInt(match[1]) : 0;
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        
        const result = await userService.getUserInvoicesWithPagination(user, page, 5, ctx);
        
        await messageService.editMessage(
            ctx,
            result.message,
            createInvoicesKeyboard(result.invoices, result.allInvoices.length, page, ctx)
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'invoice_pagination', 'page_change');
    }
}

/**
 * Handles invoice detail view
 */
export async function handleInvoiceDetail(ctx: BotContext): Promise<void> {
    logger.info('[HandleInvoiceDetail] Starting invoice detail view');
    
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    if (!validationService.validateCallbackContextWithData(ctx)) {
        logger.error('[HandleInvoiceDetail] Invalid context or no callback data');
        return;
    }

    logger.info('[HandleInvoiceDetail] Callback data:', ctx.callbackQuery!.data);

    const match = ctx.callbackQuery!.data!.match(/invoice_(\d+)/);
    if (!match) {
        logger.error('[HandleInvoiceDetail] Invalid callback data format');
        return;
    }

    const invoiceId = validationService.validatePositiveNumber(parseInt(match[1])) ? parseInt(match[1]) : null;
    if (!invoiceId) {
        logger.error('[HandleInvoiceDetail] Invalid invoice ID');
        return;
    }
    
    logger.info('[HandleInvoiceDetail] Parsed invoice ID:', invoiceId);
    
    const invoiceRepo = AppDataSource.getRepository(UserInvoice);
    const invoice = await invoiceRepo.findOne({ 
        where: { id: invoiceId },
        relations: ['user']
    });

    logger.info('[HandleInvoiceDetail] Found invoice:', invoice ? {
        id: invoice.id,
        invoiceId: invoice.invoiceId,
        status: invoice.status
    } : 'null');

    if (!invoice) {
        logger.error('[HandleInvoiceDetail] Invoice not found for ID:', invoiceId);
        await messageService.showError(ctx, ctx.t('error-invoice-not-found'));
        return;
    }

    // Fetch latest status from xRocket Pay
    try {
        const xrocketPay = XRocketPayService.getInstance();
        const xrocketResponse = await xrocketPay.checkInvoiceStatus(invoice.invoiceId);
        logger.info('[HandleInvoiceDetail] xRocket Pay response:', xrocketResponse);
        
        // Map xRocket Pay status to internal status
        let newStatus = invoice.status;
        if (xrocketResponse.status) {
            switch (xrocketResponse.status.toLowerCase()) {
                case 'paid':
                    newStatus = 'paid';
                    break;
                case 'expired':
                    newStatus = 'expired';
                    break;
                case 'active':
                    newStatus = 'active';
                    break;
            }
        }

        // Update database if status changed
        if (invoice.status !== newStatus) {
            logger.info('[HandleInvoiceDetail] Status changed from', invoice.status, 'to', newStatus);
            await invoiceRepo.update(invoice.id, {
                status: newStatus
            });
        }
    } catch (error) {
        errorHandler.logError(error, ErrorType.API_ERROR, {
            conversation: 'callback_handlers',
            action: 'handle_invoice_detail',
            data: { invoiceId: invoice.invoiceId }
        });
        // Continue with existing status if API call fails
    }

    // Reload invoice to get updated status
    const updatedInvoice = await invoiceRepo.findOne({ 
        where: { id: invoiceId },
        relations: ['user']
    });
    if (!updatedInvoice) {
        logger.error('[HandleInvoiceDetail] Updated invoice not found for ID:', invoiceId);
        await messageService.showError(ctx, ctx.t('error-invoice-not-found'));
        return;
    }

    const userService = UserService.getInstance();
    const detailMessage = await userService.formatInvoiceDetailMessage(updatedInvoice, ctx);
    
    await messageService.editMessage(
        ctx,
        detailMessage,
        createInvoiceDetailKeyboard(updatedInvoice, ctx)
    );
}

/**
 * Handles payment check for invoices
 */
export async function handleCheckPayment(ctx: BotContext): Promise<void> {
    logger.info('[HandleCheckPayment] Starting payment check');
    
    const messageService = MessageService.getInstance();
    
    if (!ctx.callbackQuery?.data) {
        logger.error('[HandleCheckPayment] No callback data found');
        return;
    }

    logger.info('[HandleCheckPayment] Callback data:', ctx.callbackQuery.data);

    const match = ctx.callbackQuery.data.match(/check_payment_(\d+)/);
    if (!match) {
        logger.error('[HandleCheckPayment] Invalid callback data format');
        return;
    }

    const invoiceId = parseInt(match[1]);
    logger.info('[HandleCheckPayment] Parsed invoice ID:', invoiceId);
    logger.info('[HandleCheckPayment] Invoice ID type:', typeof invoiceId);

    const invoiceRepo = AppDataSource.getRepository(UserInvoice);
    
    // Log all invoices for debugging
    const allInvoices = await invoiceRepo.find({ relations: ['user'] });
    logger.info('[HandleCheckPayment] All invoices in DB:', allInvoices.map(inv => ({ id: inv.id, invoiceId: inv.invoiceId, status: inv.status })));
    
    const invoice = await invoiceRepo.findOne({ 
        where: { id: invoiceId },
        relations: ['user']
    });

    logger.info('[HandleCheckPayment] Found invoice:', invoice ? {
        id: invoice.id,
        invoiceId: invoice.invoiceId,
        status: invoice.status,
        userId: invoice.user?.id
    } : 'null');

    if (!invoice) {
        logger.error('[HandleCheckayment] Invoice not found for ID:', invoiceId);
        await errorHandler.safeAnswerCallbackQuery(ctx, "❌ Invoice not found");
        return;
    }

    logger.info('[HandleCheckPayment] Invoice found, checking xRocket Pay status');
    logger.info('[HandleCheckPayment] xRocket Pay invoice ID:', invoice.invoiceId);

    try {
        const xrocketPay = XRocketPayService.getInstance();
        const xrocketResponse = await xrocketPay.checkInvoiceStatus(invoice.invoiceId);
        
        logger.info('[HandleCheckPayment] xRocket Pay response:', xrocketResponse);
        logger.info('[HandleCheckPayment] Current DB status:', invoice.status);
        
        if (xrocketResponse.status && xrocketResponse.status.toLowerCase() === 'paid' && invoice.status !== 'paid') {
            logger.info('[HandleCheckPayment] Payment confirmed, updating status');
            
            // Update invoice status
            await invoiceRepo.update(invoice.id, {
                status: 'paid'
            });

            // Calculate the amount to add based on paymentAmountReceived
            let amountToAdd: number;
            let paymentAmountReceived: number | undefined;
            
            if (xrocketResponse.data && xrocketResponse.data.payments && xrocketResponse.data.payments.length > 0) {
                // Use paymentAmountReceived from the first payment
                amountToAdd = xrocketResponse.data.payments[0].paymentAmountReceived;
                paymentAmountReceived = amountToAdd;
                logger.info('[HandleCheckPayment] Using paymentAmountReceived:', {
                    paymentAmount: xrocketResponse.data.payments[0].paymentAmount,
                    paymentAmountReceived: amountToAdd,
                    fee: xrocketResponse.data.payments[0].paymentAmount - amountToAdd
                });
            } else {
                // Fallback to original amount if payment data not available
                amountToAdd = parseFloat(invoice.amount.toString());
                logger.info('[HandleCheckPayment] Using fallback amount:', amountToAdd);
            }

            // Update invoice with paymentAmountReceived if available
            if (paymentAmountReceived !== undefined) {
                await invoiceRepo.update(invoice.id, {
                    paymentAmountReceived: paymentAmountReceived
                });
            }

            logger.info('[HandleCheckPayment] Updating user balance');
            // Update user balance using paymentAmountReceived (amount after fees)
            const userService = UserService.getInstance();
            
            logger.info('[HandleCheckPayment] Amount details:', {
                originalAmount: invoice.amount,
                amountToAdd: amountToAdd,
                currency: invoice.currency
            });
            
            await userService.updateBalance(invoice.user, invoice.currency as any, amountToAdd);

            logger.info('[HandleCheckPayment] Getting updated balances');
            // Show updated balance
            const balances = await userService.getUserBalances(invoice.user);
            const message = "✅ Payment confirmed! Your balance has been updated.\n\n" + userService.formatBalanceMessage(balances, ctx);
            
            logger.info('[HandleCheckPayment] Sending success message');
            await messageService.editMessage(
                ctx,
                message,
                createMainMenuKeyboard(ctx)
            );
        } else {
            logger.info('[HandleCheckPayment] Payment not confirmed or already paid');
            // Show alert instead of redirecting
            await errorHandler.safeAnswerCallbackQuery(ctx, "⏳ Payment is not received yet");
        }
    } catch (error) {
        errorHandler.logError(error, ErrorType.API_ERROR, {
            conversation: 'callback_handlers',
            action: 'handle_check_payment',
            data: { invoiceId: invoice.invoiceId }
        });
        await errorHandler.safeAnswerCallbackQuery(ctx, "❌ Error checking payment status");
    }
}

/**
 * Handles invoice deletion
 */
export async function handleDeleteInvoice(ctx: BotContext): Promise<void> {
    const messageService = MessageService.getInstance();
    
    if (!ctx.callbackQuery?.data) {
        return;
    }

    const match = ctx.callbackQuery.data.match(/delete_invoice_(\d+)/);
    if (!match) {
        return;
    }

    const invoiceId = parseInt(match[1]);
    const invoiceRepo = AppDataSource.getRepository(UserInvoice);
    const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });

    if (!invoice) {
        await messageService.showError(ctx, ctx.t('error-invoice-not-found'));
        return;
    }

    // Delete the invoice
    await invoiceRepo.remove(invoice);

    // Show updated invoice list
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    const result = await userService.getUserInvoicesWithPagination(user, 0, 5, ctx);
    
    await messageService.editMessage(
        ctx,
        ctx.t('invoices-deleted-successfully') + '\n\n' + result.message,
        createInvoicesKeyboard(result.invoices, result.allInvoices.length, 0, ctx)
    );
}

/**
 * Handles the transfer option in withdraw submenu
 */
export async function handleWithdrawTransfer(ctx: BotContext): Promise<void> {
    await handleTransferFlow(ctx);
}

/**
 * Handles the multicheque option in withdraw submenu (stub)
 */
export async function handleWithdrawMulticheque(ctx: BotContext): Promise<void> {
    await handleMultichequeFlow(ctx);
}

/**
 * Handles the external wallet option in withdraw submenu
 */
export async function handleWithdrawExternal(ctx: BotContext): Promise<void> {
    await handleExternalWithdrawalFlow(ctx);
}

/**
 * Handles opening a cheque link
 */
export async function handleOpenCheque(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery?.data) {
        return;
    }

    const match = ctx.callbackQuery.data.match(/open_cheque_(\d+)/);
    if (!match) {
        return;
    }

    const chequeId = parseInt(match[1]);
    const chequeRepo = AppDataSource.getRepository(UserCheque);
    const cheque = await chequeRepo.findOne({ 
        where: { id: chequeId },
        relations: ['user']
    });

    if (!cheque || !cheque.link) {
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
            text: "❌ Cheque not found or link unavailable" 
        });
        return;
    }

    // Answer the callback query with the link
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
        text: "🔗 Opening cheque link...",
        url: cheque.link
    });
}

/**
 * Handles withdrawal detail view
 */
export async function handleWithdrawalDetail(ctx: BotContext): Promise<void> {
    logger.info('[HandleWithdrawalDetail] Starting withdrawal detail view');
    
    const messageService = MessageService.getInstance();
    
    if (!ctx.callbackQuery?.data) {
        logger.error('[HandleWithdrawalDetail] No callback data found');
        return;
    }

    logger.info('[HandleWithdrawalDetail] Callback data:', ctx.callbackQuery.data);

    const match = ctx.callbackQuery.data.match(/withdrawal_(\d+)/);
    if (!match) {
        logger.error('[HandleWithdrawalDetail] Invalid callback data format');
        return;
    }

    const withdrawalId = parseInt(match[1]);
    logger.info('[HandleWithdrawalDetail] Parsed withdrawal ID:', withdrawalId);
    
    const withdrawalRepo = AppDataSource.getRepository(UserWithdrawal);
    const withdrawal = await withdrawalRepo.findOne({ 
        where: { id: withdrawalId },
        relations: ['user']
    });

    logger.info('[HandleWithdrawalDetail] Found withdrawal:', withdrawal ? {
        id: withdrawal.id,
        withdrawalId: withdrawal.withdrawalId,
        status: withdrawal.status
    } : 'null');

    if (!withdrawal) {
        logger.error('[HandleWithdrawalDetail] Withdrawal not found for ID:', withdrawalId);
        await messageService.showError(ctx, ctx.t('error-withdrawal-not-found'));
        return;
    }

    // Fetch latest status from xRocket Pay if we have a withdrawal ID
    if (withdrawal.withdrawalId) {
        try {
            const xrocketPay = XRocketPayService.getInstance();
            const statusResponse = await xrocketPay.getWithdrawalStatus(withdrawal.withdrawalId);
            
            logger.info('[HandleWithdrawalDetail] xRocket Pay status response:', statusResponse);
            
            if (statusResponse.success && statusResponse.data) {
                const xrocketStatus = statusResponse.data.status;
                logger.info('[HandleWithdrawalDetail] xRocket Pay status:', xrocketStatus);
                
                // Update database if status changed
                if (withdrawal.status !== xrocketStatus) {
                    logger.info('[HandleWithdrawalDetail] Status changed from', withdrawal.status, 'to', xrocketStatus);
                    await withdrawalRepo.update(withdrawal.id, {
                        status: xrocketStatus,
                        txHash: statusResponse.data.txHash || withdrawal.txHash,
                        txLink: statusResponse.data.txLink || withdrawal.txLink,
                        error: statusResponse.data.error || withdrawal.error
                    });
                }
            }
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'callback_handlers',
                action: 'handle_withdrawal_detail',
                data: { withdrawalId: withdrawal.withdrawalId }
            });
            // Continue with existing status if API call fails
        }
    }

    // Reload withdrawal to get updated data
    const updatedWithdrawal = await withdrawalRepo.findOne({ 
        where: { id: withdrawalId },
        relations: ['user']
    });
    
    if (!updatedWithdrawal) {
        logger.error('[HandleWithdrawalDetail] Failed to reload withdrawal data');
        await messageService.showError(ctx, ctx.t('error-loading-withdrawal-data'));
        return;
    }

    // Format withdrawal detail message
    const currencyConfig = CurrencyConverter.getConfig(updatedWithdrawal.currency as InternalCurrency);
    const statusEmoji = getWithdrawalStatusEmoji(updatedWithdrawal.status);
    
    let detailMessage = `${ctx.t('withdrawals-details-title')}\n\n` +
        `${ctx.t('withdrawals-amount')} ${formatCurrency(updatedWithdrawal.amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
        `${ctx.t('withdrawals-fee')} ${formatCurrency(updatedWithdrawal.fee)} ${currencyConfig.name}\n` +
        `${ctx.t('withdrawals-total')} ${formatCurrency(updatedWithdrawal.amount + updatedWithdrawal.fee)} ${currencyConfig.name}\n` +
        `${ctx.t('withdrawals-network')} ${updatedWithdrawal.network}\n` +
        `${ctx.t('withdrawals-address')} ${updatedWithdrawal.address}\n` +
        `${ctx.t('withdrawals-status')} ${statusEmoji} ${updatedWithdrawal.status}\n` +
        `${ctx.t('withdrawals-created')} ${formatDate(updatedWithdrawal.createdAt)}\n`;

    if (updatedWithdrawal.txHash) {
        detailMessage += `${ctx.t('withdrawals-tx-hash')} ${updatedWithdrawal.txHash}\n`;
    }

    if (updatedWithdrawal.error) {
        detailMessage += `${ctx.t('withdrawals-error')} ${updatedWithdrawal.error}\n`;
    }

    if (updatedWithdrawal.comment) {
        detailMessage += `${ctx.t('withdrawals-comment')} ${updatedWithdrawal.comment}\n`;
    }

    await messageService.editMessage(
        ctx,
        detailMessage,
        createWithdrawalDetailKeyboard(updatedWithdrawal, ctx)
    );
}

/**
 * Handles withdrawal status check
 */
export async function handleCheckWithdrawalStatus(ctx: BotContext): Promise<void> {
    logger.info('[HandleCheckWithdrawalStatus] Starting withdrawal status check');
    
    const messageService = MessageService.getInstance();
    
    if (!ctx.callbackQuery?.data) {
        logger.error('[HandleCheckWithdrawalStatus] No callback data found');
        return;
    }

    const match = ctx.callbackQuery.data.match(/check_withdrawal_(\d+)/);
    if (!match) {
        logger.error('[HandleCheckWithdrawalStatus] Invalid callback data format');
        return;
    }

    const withdrawalId = parseInt(match[1]);
    logger.info('[HandleCheckWithdrawalStatus] Parsed withdrawal ID:', withdrawalId);

    const withdrawalRepo = AppDataSource.getRepository(UserWithdrawal);
    const withdrawal = await withdrawalRepo.findOne({ 
        where: { id: withdrawalId },
        relations: ['user']
    });

    if (!withdrawal || !withdrawal.withdrawalId) {
        logger.error('[HandleCheckWithdrawalStatus] Withdrawal not found or no xRocket Pay ID');
        await errorHandler.safeAnswerCallbackQuery(ctx, "❌ Withdrawal not found or no external ID");
        return;
    }

    try {
        const xrocketPay = XRocketPayService.getInstance();
        const statusResponse = await xrocketPay.getWithdrawalStatus(withdrawal.withdrawalId);
        
        if (statusResponse.success && statusResponse.data) {
            const newStatus = statusResponse.data.status;
            
            // Update database if status changed
            if (withdrawal.status !== newStatus) {
                await withdrawalRepo.update(withdrawal.id, {
                    status: newStatus,
                    txHash: statusResponse.data.txHash || withdrawal.txHash,
                    txLink: statusResponse.data.txLink || withdrawal.txLink,
                    error: statusResponse.data.error || withdrawal.error
                });
                
                // Reload withdrawal to get updated data
                const updatedWithdrawal = await withdrawalRepo.findOne({ 
                    where: { id: withdrawalId },
                    relations: ['user']
                });
                
                if (updatedWithdrawal) {
                    // Update the message with new status
                    const currencyConfig = CurrencyConverter.getConfig(updatedWithdrawal.currency as InternalCurrency);
                    const statusEmoji = getWithdrawalStatusEmoji(newStatus);
                    
                    let detailMessage = `${ctx.t('withdrawals-details-title')}\n\n` +
                        `${ctx.t('withdrawals-amount')} ${formatCurrency(updatedWithdrawal.amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
                        `${ctx.t('withdrawals-fee')} ${formatCurrency(updatedWithdrawal.fee)} ${currencyConfig.name}\n` +
                        `${ctx.t('withdrawals-total')} ${formatCurrency(updatedWithdrawal.amount + updatedWithdrawal.fee)} ${currencyConfig.name}\n` +
                        `${ctx.t('withdrawals-network')} ${updatedWithdrawal.network}\n` +
                        `${ctx.t('withdrawals-address')} ${updatedWithdrawal.address}\n` +
                        `${ctx.t('withdrawals-status')} ${statusEmoji} ${newStatus}\n` +
                        `${ctx.t('withdrawals-created')} ${formatDate(updatedWithdrawal.createdAt)}\n`;

                    if (updatedWithdrawal.txHash) {
                        detailMessage += `${ctx.t('withdrawals-tx-hash')} ${updatedWithdrawal.txHash}\n`;
                    }

                    if (updatedWithdrawal.error) {
                        detailMessage += `${ctx.t('withdrawals-error')} ${updatedWithdrawal.error}\n`;
                    }

                    if (updatedWithdrawal.comment) {
                        detailMessage += `${ctx.t('withdrawals-comment')} ${updatedWithdrawal.comment}\n`;
                    }

                    await messageService.editMessage(
                        ctx,
                        detailMessage,
                        createWithdrawalDetailKeyboard(updatedWithdrawal, ctx)
                    );
                }
                
                const statusEmoji = getWithdrawalStatusEmoji(newStatus);
                await errorHandler.safeAnswerCallbackQuery(ctx, `✅ Status updated: ${statusEmoji} ${newStatus}`);
            } else {
                await errorHandler.safeAnswerCallbackQuery(ctx, "⏳ Status unchanged");
            }
        } else {
            await errorHandler.safeAnswerCallbackQuery(ctx, "❌ Failed to get status from external service");
        }
    } catch (error) {
        errorHandler.logError(error, ErrorType.API_ERROR, {
            conversation: 'callback_handlers',
            action: 'handle_check_withdrawal_status',
            data: { withdrawalId: withdrawal.withdrawalId }
        });
        await errorHandler.safeAnswerCallbackQuery(ctx, "❌ Error checking withdrawal status");
    }
}

/**
 * Get status emoji for withdrawal status
 */
function getWithdrawalStatusEmoji(status: string): string {
    switch (status) {
        case 'CREATED': return '⏳';
        case 'COMPLETED': return '✅';
        case 'FAIL': return '❌';
        default: return '❓';
    }
}

/**
 * Handles transfer history
 */
export async function handleHistoryTransfers(ctx: BotContext): Promise<void> {
    const messageService = MessageService.getInstance();
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    const transferRepo = AppDataSource.getRepository(UserTransfer);
    const allTransfers = await transferRepo.find({
        where: { sender: { id: user.id } },
        order: { createdAt: 'DESC' },
        relations: ['sender']
    });
    
    const pageSize = 5;
    const transfers = allTransfers.slice(0, pageSize);
    
    const message = transfers.length > 0 
        ? `🔄 My Transfers (${allTransfers.length} total)\n\nSelect a transfer to view details:`
        : "🔄 My Transfers\n\nNo transfers found.";
    
    await messageService.editMessage(
        ctx,
        message,
        createTransfersKeyboard(transfers, allTransfers.length, 0, ctx)
    );
}

/**
 * Handles transfer pagination
 */
export async function handleTransferPagination(ctx: BotContext): Promise<void> {
    const messageService = MessageService.getInstance();
    
    if (!ctx.callbackQuery?.data) {
        return;
    }

    const match = ctx.callbackQuery.data.match(/transfers_page_(\d+)/);
    if (!match) {
        return;
    }

    const page = parseInt(match[1]);
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    const transferRepo = AppDataSource.getRepository(UserTransfer);
    const allTransfers = await transferRepo.find({
        where: { sender: { id: user.id } },
        order: { createdAt: 'DESC' },
        relations: ['sender']
    });
    
    const pageSize = 5;
    const startIndex = page * pageSize;
    const transfers = allTransfers.slice(startIndex, startIndex + pageSize);
    
    const message = transfers.length > 0 
        ? `🔄 My Transfers (${allTransfers.length} total)\n\nSelect a transfer to view details:`
        : "🔄 My Transfers\n\nNo transfers found.";
    
    await messageService.editMessage(
        ctx,
        message,
        createTransfersKeyboard(transfers, allTransfers.length, page, ctx)
    );
}

/**
 * Handles cheque history
 */
export async function handleHistoryCheques(ctx: BotContext): Promise<void> {
    const messageService = MessageService.getInstance();
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    const chequeRepo = AppDataSource.getRepository(UserCheque);
    const allCheques = await chequeRepo.find({
        where: { user: { id: user.id } },
        order: { createdAt: 'DESC' },
        relations: ['user']
    });
    
    const pageSize = 5;
    const cheques = allCheques.slice(0, pageSize);
    
    const message = cheques.length > 0 
        ? `${ctx.t('cheques-title')} (${allCheques.length} ${ctx.t('total')})\n\n${ctx.t('cheques-select-to-view')}`
        : `${ctx.t('cheques-title')}\n\n${ctx.t('cheques-no-cheques')}`;
    
    await messageService.editMessage(
        ctx,
        message,
        createChequesKeyboard(cheques, allCheques.length, 0, ctx)
    );
}

/**
 * Handles cheque pagination
 */
export async function handleChequePagination(ctx: BotContext): Promise<void> {
    const messageService = MessageService.getInstance();
    
    if (!ctx.callbackQuery?.data) {
        return;
    }

    const match = ctx.callbackQuery.data.match(/cheques_page_(\d+)/);
    if (!match) {
        return;
    }

    const page = parseInt(match[1]);
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    const chequeRepo = AppDataSource.getRepository(UserCheque);
    const allCheques = await chequeRepo.find({
        where: { user: { id: user.id } },
        order: { createdAt: 'DESC' },
        relations: ['user']
    });
    
    const pageSize = 5;
    const startIndex = page * pageSize;
    const cheques = allCheques.slice(startIndex, startIndex + pageSize);
    
    const message = cheques.length > 0 
        ? `${ctx.t('cheques-title')} (${allCheques.length} ${ctx.t('total')})\n\n${ctx.t('cheques-select-to-view')}`
        : `${ctx.t('cheques-title')}\n\n${ctx.t('cheques-no-cheques')}`;
    
    await messageService.editMessage(
        ctx,
        message,
        createChequesKeyboard(cheques, allCheques.length, page, ctx)
    );
}

/**
 * Handles withdrawal history
 */
export async function handleHistoryWithdrawals(ctx: BotContext): Promise<void> {
    const messageService = MessageService.getInstance();
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    const withdrawalRepo = AppDataSource.getRepository(UserWithdrawal);
    const allWithdrawals = await withdrawalRepo.find({
        where: { user: { id: user.id } },
        order: { createdAt: 'DESC' },
        relations: ['user']
    });
    
    const pageSize = 5;
    const withdrawals = allWithdrawals.slice(0, pageSize);
    
    const message = withdrawals.length > 0 
        ? `${ctx.t('withdrawals-blockchain-title')} (${allWithdrawals.length} ${ctx.t('total')})\n\n${ctx.t('withdrawals-select-to-view')}`
        : `${ctx.t('withdrawals-blockchain-title')}\n\n${ctx.t('withdrawals-no-withdrawals')}`;
    
    await messageService.editMessage(
        ctx,
        message,
        createWithdrawalsKeyboard(withdrawals, allWithdrawals.length, 0, ctx)
    );
}

/**
 * Handles withdrawal pagination
 */
export async function handleWithdrawalPagination(ctx: BotContext): Promise<void> {
    const messageService = MessageService.getInstance();
    
    if (!ctx.callbackQuery?.data) {
        return;
    }

    const match = ctx.callbackQuery.data.match(/withdrawals_page_(\d+)/);
    if (!match) {
        return;
    }

    const page = parseInt(match[1]);
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    const withdrawalRepo = AppDataSource.getRepository(UserWithdrawal);
    const allWithdrawals = await withdrawalRepo.find({
        where: { user: { id: user.id } },
        order: { createdAt: 'DESC' },
        relations: ['user']
    });
    
    const pageSize = 5;
    const startIndex = page * pageSize;
    const withdrawals = allWithdrawals.slice(startIndex, startIndex + pageSize);
    
    const message = withdrawals.length > 0 
        ? `${ctx.t('withdrawals-blockchain-title')} (${allWithdrawals.length} ${ctx.t('total')})\n\n${ctx.t('withdrawals-select-to-view')}`
        : `${ctx.t('withdrawals-blockchain-title')}\n\n${ctx.t('withdrawals-no-withdrawals')}`;
    
    await messageService.editMessage(
        ctx,
        message,
        createWithdrawalsKeyboard(withdrawals, allWithdrawals.length, page, ctx)
    );
}

/**
 * Handles transfer detail view
 */
export async function handleTransferDetail(ctx: BotContext): Promise<void> {
    logger.info('[HandleTransferDetail] Starting transfer detail view');
    
    const messageService = MessageService.getInstance();
    
    if (!ctx.callbackQuery?.data) {
        logger.error('[HandleTransferDetail] No callback data found');
        return;
    }

    const match = ctx.callbackQuery.data.match(/transfer_(\d+)/);
    if (!match) {
        logger.error('[HandleTransferDetail] Invalid callback data format');
        return;
    }

    const transferId = parseInt(match[1]);
    logger.info('[HandleTransferDetail] Parsed transfer ID:', transferId);
    
    const transferRepo = AppDataSource.getRepository(UserTransfer);
    const transfer = await transferRepo.findOne({ 
        where: { id: transferId },
        relations: ['sender']
    });

    logger.info('[HandleTransferDetail] Found transfer:', transfer ? {
        id: transfer.id,
        amount: transfer.amount,
        currency: transfer.currency,
        recipientTelegramId: transfer.recipientTelegramId
    } : 'null');

    if (!transfer) {
        logger.error('[HandleTransferDetail] Transfer not found for ID:', transferId);
        await messageService.showError(ctx, ctx.t('error-transfer-not-found'));
        return;
    }

    // Format transfer detail message
    const currencyConfig = CurrencyConverter.getConfig(transfer.currency as InternalCurrency);
    
    const detailMessage = `🔄 Transfer Details\n\n` +
        `💰 Amount: ${formatCurrency(transfer.amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
        `👤 Recipient ID: ${transfer.recipientTelegramId}\n` +
        `📅 Created: ${formatDate(transfer.createdAt)}\n` +
        `🆔 Transfer ID: ${transfer.id}`;

    await messageService.editMessage(
        ctx,
        detailMessage,
        createTransferDetailKeyboard(transfer, ctx)
    );
}

/**
 * Handles cheque detail view
 */
export async function handleChequeDetail(ctx: BotContext): Promise<void> {
    logger.info('[HandleChequeDetail] Starting cheque detail view');
    
    const messageService = MessageService.getInstance();
    
    if (!ctx.callbackQuery?.data) {
        logger.error('[HandleChequeDetail] No callback data found');
        return;
    }

    const match = ctx.callbackQuery.data.match(/cheque_(\d+)/);
    if (!match) {
        logger.error('[HandleChequeDetail] Invalid callback data format');
        return;
    }

    const chequeId = parseInt(match[1]);
    logger.info('[HandleChequeDetail] Parsed cheque ID:', chequeId);

    const chequeRepo = AppDataSource.getRepository(UserCheque);
    let cheque = await chequeRepo.findOne({ 
        where: { id: chequeId },
        relations: ['user']
    });

    // Update status from xRocket Pay if we have chequeId
    if (cheque && cheque.chequeId) {
        try {
            const xrocketPay = XRocketPayService.getInstance();
            const response = await xrocketPay.getMulticheque(cheque.chequeId);
            if (response.success && response.data) {
                // Update local cheque if status or link changed
                const newStatus = response.data.state;
                const newLink = response.data.link;
                if (cheque.status !== newStatus || cheque.link !== newLink) {
                    await chequeRepo.update(cheque.id, {
                        status: newStatus,
                        link: newLink
                    });
                    cheque = await chequeRepo.findOne({ where: { id: chequeId }, relations: ['user'] });
                }
            }
        } catch (err) {
            errorHandler.logError(err, ErrorType.API_ERROR, {
                conversation: 'callback_handlers',
                action: 'handle_cheque_detail',
                data: { chequeId: cheque?.chequeId }
            });
            // Continue with existing status if API call fails
        }
    }

    if (!cheque) {
        logger.error('[HandleChequeDetail] Cheque not found before rendering details');
        await errorHandler.safeAnswerCallbackQuery(ctx, "❌ Cheque not found");
        return;
    }

    const currencyConfig = CurrencyConverter.getConfig(cheque.currency as InternalCurrency);
    const statusEmoji = getChequeStatusEmoji(cheque.status);
    
    let detailMessage = `${ctx.t('cheques-details-title')}\n\n` +
        `${ctx.t('cheques-amount')} ${formatCurrency(cheque.amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
        `${ctx.t('cheques-users')} ${cheque.usersNumber}\n` +
        `${ctx.t('cheques-status')} ${statusEmoji} ${cheque.status}\n` +
        `${ctx.t('cheques-cheque-id')} ${cheque.chequeId}\n` +
        `${ctx.t('cheques-created')} ${formatDate(cheque.createdAt)}\n`;

    await messageService.editMessage(
        ctx,
        detailMessage,
        createChequeDetailKeyboard(cheque, ctx)
    );
}

/**
 * Get status emoji for cheque status
 */
function getChequeStatusEmoji(status: string): string {
    switch (status) {
        case 'active': return '⏳';
        case 'completed': return '✅';
        case 'draft': return '📝';
        default: return '❓';
    }
} 