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
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    await userService.displayBalance(ctx, user);
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

    // Fetch latest status from XRocket Pay
    try {
        const xrocketPay = XRocketPayService.getInstance();
        const xrocketStatus = await xrocketPay.checkInvoiceStatus(invoice.invoiceId);
        
        logger.info('[HandleInvoiceDetail] XRocket Pay status:', xrocketStatus);
        
        // Map XRocket Pay status to internal status
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
        logger.error('[HandleInvoiceDetail] Error fetching invoice status from XRocket Pay:', error);
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

    logger.info('[HandleCheckPayment] Invoice found, checking XRocket Pay status');
    logger.info('[HandleCheckPayment] XRocket Pay invoice ID:', invoice.invoiceId);

    try {
        const xrocketPay = XRocketPayService.getInstance();
        const xrocketStatus = await xrocketPay.checkInvoiceStatus(invoice.invoiceId);
        
        logger.info('[HandleCheckPayment] XRocket Pay status:', xrocketStatus);
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
    await ctx.reply("🧾 Multicheque functionality coming soon!", {
        reply_markup: createWithdrawMenuKeyboard()
    });
}

/**
 * Handles the external wallet option in withdraw submenu (stub)
 */
export async function handleWithdrawExternal(ctx: BotContext): Promise<void> {
    await ctx.reply("🌐 External wallet withdrawal coming soon!", {
        reply_markup: createWithdrawMenuKeyboard()
    });
} 