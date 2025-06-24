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
import { formatNumber } from "../utils/formatters";
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
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for main menu");
        }

        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        
        const balances = await userService.getUserBalances(user);
        const message = userService.formatBalanceMessage(balances);

        await messageService.editMessage(
            ctx,
            message,
            createMainMenuKeyboard()
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
            "💸 Choose withdrawal option:",
            createWithdrawMenuKeyboard()
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
            "📊 My Withdrawals\n\nChoose the type of withdrawal history you want to view:",
            createWithdrawalHistoryMenuKeyboard()
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
        
        const result = await userService.getUserInvoicesWithPagination(user, 0, 5);
        
        await messageService.editMessage(
            ctx,
            result.message,
            createInvoicesKeyboard(result.invoices, result.allInvoices.length, 0)
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
        
        const result = await userService.getUserInvoicesWithPagination(user, page, 5);
        
        await messageService.editMessage(
            ctx,
            result.message,
            createInvoicesKeyboard(result.invoices, result.allInvoices.length, page)
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
        await messageService.showError(ctx, "Invoice not found");
        return;
    }

    // Fetch latest status from xRocket Pay
    try {
        const xrocketPay = XRocketPayService.getInstance();
        const xrocketStatus = await xrocketPay.checkInvoiceStatus(invoice.invoiceId);
        
        logger.info('[HandleInvoiceDetail] xRocket Pay status:', xrocketStatus);
        
        // Map xRocket Pay status to internal status
        let newStatus = invoice.status;
        switch (xrocketStatus.toLowerCase()) {
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
        await messageService.showError(ctx, "Invoice not found");
        return;
    }

    const userService = UserService.getInstance();
    const detailMessage = userService.formatInvoiceDetailMessage(updatedInvoice);
    
    await messageService.editMessage(
        ctx,
        detailMessage,
        createInvoiceDetailKeyboard(updatedInvoice)
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
        const xrocketStatus = await xrocketPay.checkInvoiceStatus(invoice.invoiceId);
        
        logger.info('[HandleCheckPayment] xRocket Pay status:', xrocketStatus);
        logger.info('[HandleCheckPayment] Current DB status:', invoice.status);
        
        if (xrocketStatus.toLowerCase() === 'paid' && invoice.status !== 'paid') {
            logger.info('[HandleCheckPayment] Payment confirmed, updating status');
            
            // Update invoice status
            await invoiceRepo.update(invoice.id, {
                status: 'paid'
            });

            logger.info('[HandleCheckPayment] Updating user balance');
            // Update user balance
            const userService = UserService.getInstance();
            const amountToAdd = parseFloat(invoice.amount.toString());
            logger.info('[HandleCheckPayment] Amount details:', {
                originalAmount: invoice.amount,
                originalType: typeof invoice.amount,
                parsedAmount: amountToAdd,
                parsedType: typeof amountToAdd
            });
            await userService.updateBalance(invoice.user, invoice.currency as any, amountToAdd);

            logger.info('[HandleCheckPayment] Getting updated balances');
            // Show updated balance
            const balances = await userService.getUserBalances(invoice.user);
            const message = "✅ Payment confirmed! Your balance has been updated.\n\n" + userService.formatBalanceMessage(balances);
            
            logger.info('[HandleCheckPayment] Sending success message');
            await messageService.editMessage(
                ctx,
                message,
                createMainMenuKeyboard()
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
        await messageService.showError(ctx, "Invoice not found");
        return;
    }

    // Delete the invoice
    await invoiceRepo.remove(invoice);

    // Show updated invoice list
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    const result = await userService.getUserInvoicesWithPagination(user, 0, 5);
    
    await messageService.editMessage(
        ctx,
        "🗑️ Invoice deleted successfully!\n\n" + result.message,
        createInvoicesKeyboard(result.invoices, result.allInvoices.length, 0)
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
        await messageService.showError(ctx, "Withdrawal not found");
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
        await messageService.showError(ctx, "Error loading withdrawal data");
        return;
    }

    // Format withdrawal detail message
    const currencyConfig = CurrencyConverter.getConfig(updatedWithdrawal.currency as InternalCurrency);
    const statusEmoji = getWithdrawalStatusEmoji(updatedWithdrawal.status);
    
    let detailMessage = `🌐 Withdrawal Details\n\n` +
        `💰 Amount: ${formatNumber(updatedWithdrawal.amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
        `💸 Fee: ${formatNumber(updatedWithdrawal.fee)} ${currencyConfig.name}\n` +
        `💰 Total: ${formatNumber(updatedWithdrawal.amount + updatedWithdrawal.fee)} ${currencyConfig.name}\n` +
        `🌐 Network: ${updatedWithdrawal.network}\n` +
        `🔗 Address: ${updatedWithdrawal.address}\n` +
        `📊 Status: ${statusEmoji} ${updatedWithdrawal.status}\n` +
        `📅 Created: ${updatedWithdrawal.createdAt.toLocaleDateString()}\n`;

    if (updatedWithdrawal.txHash) {
        detailMessage += `🔗 Transaction Hash: ${updatedWithdrawal.txHash}\n`;
    }

    if (updatedWithdrawal.error) {
        detailMessage += `❌ Error: ${updatedWithdrawal.error}\n`;
    }

    if (updatedWithdrawal.comment) {
        detailMessage += `💬 Comment: ${updatedWithdrawal.comment}\n`;
    }

    await messageService.editMessage(
        ctx,
        detailMessage,
        createWithdrawalDetailKeyboard(updatedWithdrawal)
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
                    
                    let detailMessage = `🌐 Withdrawal Details\n\n` +
                        `💰 Amount: ${formatNumber(updatedWithdrawal.amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
                        `💸 Fee: ${formatNumber(updatedWithdrawal.fee)} ${currencyConfig.name}\n` +
                        `💰 Total: ${formatNumber(updatedWithdrawal.amount + updatedWithdrawal.fee)} ${currencyConfig.name}\n` +
                        `🌐 Network: ${updatedWithdrawal.network}\n` +
                        `🔗 Address: ${updatedWithdrawal.address}\n` +
                        `📊 Status: ${statusEmoji} ${newStatus}\n` +
                        `🆔 Withdrawal ID: ${updatedWithdrawal.withdrawalId}\n` +
                        `📅 Created: ${updatedWithdrawal.createdAt.toLocaleDateString()}\n`;

                    if (updatedWithdrawal.txHash) {
                        detailMessage += `🔗 Transaction Hash: ${updatedWithdrawal.txHash}\n`;
                    }

                    if (updatedWithdrawal.error) {
                        detailMessage += `❌ Error: ${updatedWithdrawal.error}\n`;
                    }

                    if (updatedWithdrawal.comment) {
                        detailMessage += `💬 Comment: ${updatedWithdrawal.comment}\n`;
                    }

                    await messageService.editMessage(
                        ctx,
                        detailMessage,
                        createWithdrawalDetailKeyboard(updatedWithdrawal)
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
        createTransfersKeyboard(transfers, allTransfers.length, 0)
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
        createTransfersKeyboard(transfers, allTransfers.length, page)
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
        ? `🎫 My Cheques (${allCheques.length} total)\n\nSelect a cheque to view details:`
        : "🎫 My Cheques\n\nNo cheques found.";
    
    await messageService.editMessage(
        ctx,
        message,
        createChequesKeyboard(cheques, allCheques.length, 0)
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
        ? `🎫 My Cheques (${allCheques.length} total)\n\nSelect a cheque to view details:`
        : "🎫 My Cheques\n\nNo cheques found.";
    
    await messageService.editMessage(
        ctx,
        message,
        createChequesKeyboard(cheques, allCheques.length, page)
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
        ? `🌐 My Blockchain Withdrawals (${allWithdrawals.length} total)\n\nSelect a withdrawal to view details:`
        : "🌐 My Blockchain Withdrawals\n\nNo withdrawals found.";
    
    await messageService.editMessage(
        ctx,
        message,
        createWithdrawalsKeyboard(withdrawals, allWithdrawals.length, 0)
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
        ? `🌐 My Blockchain Withdrawals (${allWithdrawals.length} total)\n\nSelect a withdrawal to view details:`
        : "🌐 My Blockchain Withdrawals\n\nNo withdrawals found.";
    
    await messageService.editMessage(
        ctx,
        message,
        createWithdrawalsKeyboard(withdrawals, allWithdrawals.length, page)
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
        await messageService.showError(ctx, "Transfer not found");
        return;
    }

    // Format transfer detail message
    const currencyConfig = CurrencyConverter.getConfig(transfer.currency as InternalCurrency);
    
    const detailMessage = `🔄 Transfer Details\n\n` +
        `💰 Amount: ${formatNumber(transfer.amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
        `👤 Recipient ID: ${transfer.recipientTelegramId}\n` +
        `📅 Created: ${transfer.createdAt.toLocaleDateString()}\n` +
        `🆔 Transfer ID: ${transfer.id}`;

    await messageService.editMessage(
        ctx,
        detailMessage,
        createTransferDetailKeyboard(transfer)
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
    
    let detailMessage = `🎫 Cheque Details\n\n` +
        `💰 Amount: ${formatNumber(cheque.amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
        `👥 Users: ${cheque.usersNumber}\n` +
        `📊 Status: ${statusEmoji} ${cheque.status}\n` +
        `🆔 Cheque ID: ${cheque.chequeId}\n` +
        `📅 Created: ${cheque.createdAt.toLocaleDateString()}\n`;

    await messageService.editMessage(
        ctx,
        detailMessage,
        createChequeDetailKeyboard(cheque)
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