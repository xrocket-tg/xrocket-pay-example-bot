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
import { createWithdrawalDetailKeyboard } from "../keyboards/withdrawal";
import { UserWithdrawal } from "../../entities/user-withdrawal";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";

/**
 * Handles the main menu balance display
 */
export async function handleBalance(ctx: BotContext): Promise<void> {
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    await userService.displayBalance(ctx, user);
}

/**
 * Handles the deposit button click
 */
export async function handleDeposit(ctx: BotContext): Promise<void> {
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    await userService.displayBalance(ctx, user);
}

/**
 * Handles the main menu button click
 */
export async function handleMainMenu(ctx: BotContext): Promise<void> {
    if (!ctx.chat || !ctx.callbackQuery?.message) {
        throw new Error("Invalid context for main menu");
    }

    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    const balances = await userService.getUserBalances(user);
    const message = userService.formatBalanceMessage(balances);

    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message.message_id,
        message,
        { reply_markup: createMainMenuKeyboard() }
    );
}

/**
 * Handles the withdraw button click (shows withdraw submenu)
 */
export async function handleWithdraw(ctx: BotContext): Promise<void> {
    await ctx.api.editMessageText(
        ctx.chat!.id,
        ctx.callbackQuery!.message!.message_id,
        "💸 Choose withdrawal option:",
        {
            reply_markup: createWithdrawMenuKeyboard()
        }
    );
}

/**
 * Handles the my withdrawals button click (placeholder)
 */
export async function handleMyWithdrawals(ctx: BotContext): Promise<void> {
    await ctx.reply("📊 My Withdrawals functionality coming soon!", {
        reply_markup: createMainMenuKeyboard()
    });
}

/**
 * Handles the my invoices button click
 */
export async function handleInvoices(ctx: BotContext): Promise<void> {
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    const result = await userService.getUserInvoicesWithPagination(user, 0, 5);
    
    await ctx.reply(result.message, {
        reply_markup: createInvoicesKeyboard(result.invoices, result.allInvoices.length, 0)
    });
}

/**
 * Handles invoice pagination
 */
export async function handleInvoicePagination(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery?.data) {
        return;
    }

    const match = ctx.callbackQuery.data.match(/invoices_page_(\d+)/);
    if (!match) {
        return;
    }

    const page = parseInt(match[1]);
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    
    const result = await userService.getUserInvoicesWithPagination(user, page, 5);
    
    await ctx.api.editMessageText(
        ctx.chat!.id,
        ctx.callbackQuery.message!.message_id,
        result.message,
        {
            reply_markup: createInvoicesKeyboard(result.invoices, result.allInvoices.length, page)
        }
    );
}

/**
 * Handles invoice detail view
 */
export async function handleInvoiceDetail(ctx: BotContext): Promise<void> {
    logger.info('[HandleInvoiceDetail] Starting invoice detail view');
    
    if (!ctx.callbackQuery?.data) {
        logger.error('[HandleInvoiceDetail] No callback data found');
        return;
    }

    logger.info('[HandleInvoiceDetail] Callback data:', ctx.callbackQuery.data);

    const match = ctx.callbackQuery.data.match(/invoice_(\d+)/);
    if (!match) {
        logger.error('[HandleInvoiceDetail] Invalid callback data format');
        return;
    }

    const invoiceId = parseInt(match[1]);
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
        await ctx.reply("❌ Invoice not found", {
            reply_markup: createMainMenuKeyboard()
        });
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
        logger.error('[HandleInvoiceDetail] Error fetching invoice status from xRocket Pay:', error);
        // Continue with existing status if API call fails
    }

    // Reload invoice to get updated status
    const updatedInvoice = await invoiceRepo.findOne({ 
        where: { id: invoiceId },
        relations: ['user']
    });
    if (!updatedInvoice) {
        logger.error('[HandleInvoiceDetail] Updated invoice not found for ID:', invoiceId);
        await ctx.reply("❌ Invoice not found", {
            reply_markup: createMainMenuKeyboard()
        });
        return;
    }

    const userService = UserService.getInstance();
    const detailMessage = userService.formatInvoiceDetailMessage(updatedInvoice);
    
    await ctx.api.editMessageText(
        ctx.chat!.id,
        ctx.callbackQuery.message!.message_id,
        detailMessage,
        {
            reply_markup: createInvoiceDetailKeyboard(updatedInvoice)
        }
    );
}

/**
 * Handles payment check for invoices
 */
export async function handleCheckPayment(ctx: BotContext): Promise<void> {
    logger.info('[HandleCheckPayment] Starting payment check');
    
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
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "❌ Invoice not found" });
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
            await ctx.api.editMessageText(
                ctx.chat!.id,
                ctx.callbackQuery.message!.message_id,
                message,
                { reply_markup: createMainMenuKeyboard() }
            );
        } else {
            logger.info('[HandleCheckPayment] Payment not confirmed or already paid');
            // Show alert instead of redirecting
            await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
                text: "⏳ Payment is not received yet" 
            });
        }
    } catch (error) {
        logger.error('[HandleCheckPayment] Error checking payment:', error);
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
            text: "❌ Error checking payment status" 
        });
    }
}

/**
 * Handles invoice deletion
 */
export async function handleDeleteInvoice(ctx: BotContext): Promise<void> {
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
        await ctx.reply("❌ Invoice not found", {
            reply_markup: createMainMenuKeyboard()
        });
        return;
    }

    // Delete the invoice
    await invoiceRepo.remove(invoice);

    // Show updated invoice list
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    const result = await userService.getUserInvoicesWithPagination(user, 0, 5);
    
    await ctx.api.editMessageText(
        ctx.chat!.id,
        ctx.callbackQuery.message!.message_id,
        "🗑️ Invoice deleted successfully!\n\n" + result.message,
        {
            reply_markup: createInvoicesKeyboard(result.invoices, result.allInvoices.length, 0)
        }
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
        await ctx.reply("❌ Withdrawal not found", {
            reply_markup: createMainMenuKeyboard()
        });
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
            logger.error('[HandleWithdrawalDetail] Error fetching withdrawal status from xRocket Pay:', error);
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
        await ctx.reply("❌ Error loading withdrawal data", {
            reply_markup: createMainMenuKeyboard()
        });
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

    await ctx.api.editMessageText(
        ctx.chat!.id,
        ctx.callbackQuery.message!.message_id,
        detailMessage,
        { reply_markup: createWithdrawalDetailKeyboard(updatedWithdrawal) }
    );
}

/**
 * Handles withdrawal status check
 */
export async function handleCheckWithdrawalStatus(ctx: BotContext): Promise<void> {
    logger.info('[HandleCheckWithdrawalStatus] Starting withdrawal status check');
    
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
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
            text: "❌ Withdrawal not found or no external ID" 
        });
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

                    await ctx.api.editMessageText(
                        ctx.chat!.id,
                        ctx.callbackQuery.message!.message_id,
                        detailMessage,
                        { reply_markup: createWithdrawalDetailKeyboard(updatedWithdrawal) }
                    );
                }
                
                const statusEmoji = getWithdrawalStatusEmoji(newStatus);
                await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
                    text: `Status updated: ${statusEmoji} ${newStatus}` 
                });
            } else {
                const statusEmoji = getWithdrawalStatusEmoji(newStatus);
                await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
                    text: `Current status: ${statusEmoji} ${newStatus}` 
                });
            }
        } else {
            await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
                text: "❌ Failed to get status from xRocket Pay" 
            });
        }
    } catch (error) {
        logger.error('[HandleCheckWithdrawalStatus] Error checking withdrawal status:', error);
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
            text: "❌ Error checking withdrawal status" 
        });
    }
}

/**
 * Handles copying withdrawal transaction hash
 */
export async function handleCopyWithdrawalHash(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery?.data) {
        return;
    }

    const match = ctx.callbackQuery.data.match(/copy_hash_(\d+)/);
    if (!match) {
        return;
    }

    const withdrawalId = parseInt(match[1]);
    const withdrawalRepo = AppDataSource.getRepository(UserWithdrawal);
    const withdrawal = await withdrawalRepo.findOne({ where: { id: withdrawalId } });

    if (!withdrawal || !withdrawal.txHash) {
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
            text: "❌ Transaction hash not available" 
        });
        return;
    }

    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
        text: `Transaction hash copied: ${withdrawal.txHash}` 
    });
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
 * Format number with currency symbol
 */
function formatNumber(value: number): string {
    return value.toLocaleString();
} 