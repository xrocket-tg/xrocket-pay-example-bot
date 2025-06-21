import { BotContext } from "../../types/bot";
import { displayBalance, formatBalanceMessage, getUserInvoicesWithPagination, formatInvoiceDetailMessage } from "../utils/user";
import { UserService } from "../../services/user";
import { createMainMenuKeyboard } from "../keyboards/main";
import { AppDataSource } from "../../config/database";
import { UserInvoice } from "../../entities/user-invoice";
import { XRocketPayService } from "../../services/xrocket-pay";
import { createInvoicesKeyboard, createInvoiceDetailKeyboard } from "../keyboards/invoices";
import logger from '../../utils/logger';
import { handleDepositFlow, handleCurrencySelection, handleAmountInput } from "../conversations/deposit";

/**
 * Handles the deposit button click
 */
export async function handleDeposit(ctx: BotContext): Promise<void> {
    logger.info('[HandleDeposit] Starting deposit flow');
    logger.info('[HandleDeposit] Chat ID:', ctx.chat?.id);
    logger.info('[HandleDeposit] Session:', ctx.session);
    
    await handleDepositFlow(ctx);
    logger.info('[HandleDeposit] Deposit flow started');
}

/**
 * Handles balance display
 */
export async function handleBalance(ctx: BotContext): Promise<void> {
    logger.info('[HandleBalance] Balance requested');
    
    if (!ctx.chat) {
        throw new Error("Chat context not found");
    }

    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    await displayBalance(ctx, user);
}

/**
 * Handles invoice list display with pagination
 */
export async function handleInvoices(ctx: BotContext): Promise<void> {
    logger.info('[HandleInvoices] Invoices requested');
    logger.info('[HandleInvoices] Chat ID:', ctx.chat?.id);
    logger.info('[HandleInvoices] Callback query data:', ctx.callbackQuery?.data);
    logger.info('[HandleInvoices] Session:', ctx.session);
    
    if (!ctx.chat || !ctx.callbackQuery) {
        logger.error('[HandleInvoices] Invalid context - missing chat or callback query');
        throw new Error("Invalid context for invoices");
    }

    logger.info('[HandleInvoices] Getting user...');
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    logger.info('[HandleInvoices] User:', user);
    
    logger.info('[HandleInvoices] Getting invoices from database...');
    const { invoices, allInvoices, message } = await getUserInvoicesWithPagination(user, 0, 5);
    logger.info('[HandleInvoices] Showing invoices:', invoices.length, 'on page: 0');

    // Answer the callback query to remove loading state
    logger.info('[HandleInvoices] Answering callback query...');
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);
    logger.info('[HandleInvoices] Callback query answered');

    // Edit the existing message with invoice keyboard
    logger.info('[HandleInvoices] Editing message...');
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        message,
        { reply_markup: createInvoicesKeyboard(invoices, 0, 5, allInvoices.length) }
    );
    logger.info('[HandleInvoices] Message edited successfully');
}

/**
 * Handles invoice pagination
 */
export async function handleInvoicePagination(ctx: BotContext): Promise<void> {
    logger.info('[HandleInvoicePagination] Pagination requested');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for invoice pagination");
    }

    const pageMatch = ctx.callbackQuery.data?.match(/invoices_page_(\d+)/);
    if (!pageMatch) {
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "❌ Invalid page" });
        return;
    }

    const page = parseInt(pageMatch[1]);
    logger.info('[HandleInvoicePagination] Page requested:', page);

    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    const { invoices, allInvoices, message } = await getUserInvoicesWithPagination(user, page, 5);

    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    // Update the message with new page
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        message,
        { reply_markup: createInvoicesKeyboard(invoices, page, 5, allInvoices.length) }
    );
}

/**
 * Handles invoice detail display
 */
export async function handleInvoiceDetail(ctx: BotContext): Promise<void> {
    logger.info('[HandleInvoiceDetail] Invoice detail requested');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for invoice detail");
    }

    const invoiceId = ctx.callbackQuery.data?.replace("invoice_", "");
    if (!invoiceId) {
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "❌ Invalid invoice ID" });
        return;
    }

    logger.info('[HandleInvoiceDetail] Invoice ID:', invoiceId);

    const invoiceRepo = AppDataSource.getRepository(UserInvoice);
    let invoice = await invoiceRepo.findOne({ 
        where: { invoiceId },
        relations: ['user']
    });

    if (!invoice) {
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "❌ Invoice not found" });
        return;
    }

    // Fetch latest status from XRocket Pay
    const xrocketPay = XRocketPayService.getInstance();
    let externalStatus: string | undefined;
    try {
        externalStatus = await xrocketPay.checkInvoiceStatus(invoiceId);
        console.log('[HandleInvoiceDetail] XRocketPay status:', externalStatus);
        console.log('[HandleInvoiceDetail] XRocketPay status type:', typeof externalStatus);
        console.log('[HandleInvoiceDetail] XRocketPay status length:', externalStatus?.length);
    } catch (err) {
        console.error('[HandleInvoiceDetail] Error fetching status from XRocketPay:', err);
    }

    // Map XRocketPay status to internal status
    let mappedStatus: 'active' | 'paid' | 'expired' = invoice.status;
    console.log('[HandleInvoiceDetail] Current DB status:', invoice.status);
    console.log('[HandleInvoiceDetail] External status from XRocketPay:', externalStatus);
    
    if (externalStatus === 'paid') mappedStatus = 'paid';
    else if (externalStatus === 'expired') mappedStatus = 'expired';
    else if (externalStatus === 'active') mappedStatus = 'active';
    else if (!externalStatus || externalStatus === '') {
        console.warn(`[HandleInvoiceDetail] Empty XRocketPay status for invoice ${invoiceId}, treating as expired`);
        mappedStatus = 'expired';
    } else {
        console.warn(`[HandleInvoiceDetail] Unrecognized XRocketPay status: "${externalStatus}" for invoice ${invoiceId}, treating as expired`);
        mappedStatus = 'expired';
    }
    
    console.log('[HandleInvoiceDetail] Mapped status:', mappedStatus);

    // Update DB if status changed
    if (invoice.status !== mappedStatus) {
        console.log('[HandleInvoiceDetail] Status changed, updating DB from', invoice.status, 'to', mappedStatus);
        invoice.status = mappedStatus;
        await invoiceRepo.save(invoice);
        console.log('[HandleInvoiceDetail] Invoice status updated in DB:', mappedStatus);
        
        // Reload the invoice to get the updated status
        const updatedInvoice = await invoiceRepo.findOne({ 
            where: { invoiceId },
            relations: ['user']
        });
        
        if (updatedInvoice) {
            invoice = updatedInvoice;
        }
    } else {
        console.log('[HandleInvoiceDetail] Status unchanged, no DB update needed');
    }

    const message = formatInvoiceDetailMessage(invoice);

    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    // Show invoice detail with keyboard
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        message,
        { reply_markup: createInvoiceDetailKeyboard(invoice) }
    );
}

/**
 * Handles invoice deletion
 */
export async function handleDeleteInvoice(ctx: BotContext): Promise<void> {
    logger.info('[HandleDeleteInvoice] Delete invoice requested');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for delete invoice");
    }

    const invoiceId = ctx.callbackQuery.data?.replace("delete_invoice_", "");
    if (!invoiceId) {
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "❌ Invalid invoice ID" });
        return;
    }

    logger.info('[HandleDeleteInvoice] Invoice ID:', invoiceId);

    // Get invoice repository
    const invoiceRepo = AppDataSource.getRepository(UserInvoice);

    try {
        // Get invoice from database
        const invoice = await invoiceRepo.findOne({ 
            where: { invoiceId },
            relations: ['user']
        });

        if (!invoice) {
            await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "❌ Invoice not found" });
            return;
        }

        // Check if invoice is already paid
        if (invoice.status === 'paid') {
            await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "❌ Cannot delete paid invoice" });
            return;
        }

        // Answer the callback query
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "🗑️ Deleting invoice..." });

        // Delete from XRocket Pay
        const xrocketPay = XRocketPayService.getInstance();
        await xrocketPay.deleteInvoice(invoiceId);

        // Delete from database
        await invoiceRepo.remove(invoice);

        logger.info('[HandleDeleteInvoice] Invoice deleted successfully');

        // Fetch user's remaining invoices with pagination
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        const { invoices, allInvoices, message } = await getUserInvoicesWithPagination(user, 0, 5);

        const successMessage = "✅ Invoice deleted successfully!\n\n" + message;

        // Show success message with paginated invoices list
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            successMessage,
            { reply_markup: createInvoicesKeyboard(invoices, 0, 5, allInvoices.length) }
        );

    } catch (error) {
        logger.error('[HandleDeleteInvoice] Error deleting invoice:', error);
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "❌ Error deleting invoice" });
        
        // Fetch user's invoices for error case too with pagination
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        const { invoices, allInvoices, message } = await getUserInvoicesWithPagination(user, 0, 5);

        const errorMessage = "❌ Failed to delete invoice. Please try again later.\n\n" + message;
        
        // Show error message with paginated invoices list
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            errorMessage,
            { reply_markup: createInvoicesKeyboard(invoices, 0, 5, allInvoices.length) }
        );
    }
}

/**
 * Handles payment status check
 */
export async function handleCheckPayment(ctx: BotContext): Promise<void> {
    logger.info('[HandleCheckPayment] Payment check requested');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for payment check");
    }

    const invoiceId = ctx.callbackQuery.data?.replace("check_payment_", "");
    if (!invoiceId) {
        await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text: "❌ Invalid invoice ID" });
        return;
    }

    try {
        const xrocketPay = XRocketPayService.getInstance();
        const status = await xrocketPay.checkInvoiceStatus(invoiceId);
        
        if (status === 'paid') {
            // Update invoice status in database
            const invoiceRepo = AppDataSource.getRepository(UserInvoice);
            const invoice = await invoiceRepo.findOne({ where: { invoiceId } });
            
            if (invoice && invoice.status !== 'paid') {
                invoice.status = 'paid';
                await invoiceRepo.save(invoice);
                
                // Update user balance
                const userService = UserService.getInstance();
                const user = await userService.findOrCreateUser(ctx);
                const balanceRepo = AppDataSource.getRepository("UserBalance");
                let balance = await balanceRepo.findOne({ 
                    where: { user: { id: user.id }, coin: invoice.currency }
                });
                
                if (!balance) {
                    balance = {
                        id: 0,
                        user,
                        coin: invoice.currency,
                        amount: 0,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                }
                
                // Convert amounts to numbers to ensure proper addition
                const currentAmount = parseFloat(balance.amount.toString());
                const invoiceAmount = parseFloat(invoice.amount.toString());
                balance.amount = currentAmount + invoiceAmount;
                balance.updatedAt = new Date();
                
                logger.info('[HandleCheckPayment] Balance update:', {
                    currentAmount,
                    invoiceAmount,
                    newAmount: balance.amount,
                    currency: invoice.currency
                });
                
                await balanceRepo.save(balance);
                
                // Get updated balances to display
                const balances = await userService.getUserBalances(user);
                const message = "✅ Payment confirmed! Your balance has been updated.\n\n" + formatBalanceMessage(balances);
                
                await ctx.api.editMessageText(
                    ctx.chat.id,
                    ctx.callbackQuery.message!.message_id,
                    message,
                    { reply_markup: createMainMenuKeyboard() }
                );
            } else {
                await ctx.api.editMessageText(
                    ctx.chat.id,
                    ctx.callbackQuery.message!.message_id,
                    "✅ Payment confirmed!",
                    { reply_markup: createMainMenuKeyboard() }
                );
            }
        } else {
            // Show alert for pending payment instead of redirecting
            await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { 
                text: "⏳ Payment is not received yet" 
            });
        }
    } catch (error) {
        logger.error('[HandleCheckPayment] Error checking payment:', error);
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            "❌ Error checking payment status. Please try again.",
            { reply_markup: createMainMenuKeyboard() }
        );
    }
}

/**
 * Handles withdraw button
 */
export async function handleWithdraw(ctx: BotContext): Promise<void> {
    logger.info('[HandleWithdraw] Withdraw requested');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for withdraw");
    }

    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    // Show coming soon message
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        "💸 Withdraw\n\n🚧 Coming Soon!\n\nThis feature will allow you to withdraw funds via:\n• Transfer to another user\n• Multicheque\n• External wallet",
        { reply_markup: createMainMenuKeyboard() }
    );
}

/**
 * Handles my withdrawals button
 */
export async function handleMyWithdrawals(ctx: BotContext): Promise<void> {
    logger.info('[HandleMyWithdrawals] My withdrawals requested');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for my withdrawals");
    }

    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    // Show coming soon message
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        "📊 My Withdrawals\n\n🚧 Coming Soon!\n\nThis feature will show your withdrawal history:\n• Transfers to other users\n• Multicheques\n• External wallet withdrawals",
        { reply_markup: createMainMenuKeyboard() }
    );
}

/**
 * Handles main menu button
 */
export async function handleMainMenu(ctx: BotContext): Promise<void> {
    logger.info('[HandleMainMenu] Main menu requested');
    
    if (!ctx.chat || !ctx.callbackQuery) {
        throw new Error("Invalid context for main menu");
    }

    // Answer the callback query
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);

    // Get user and display balance
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    const balances = await userService.getUserBalances(user);
    const message = formatBalanceMessage(balances);

    // Show main menu with balances
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        message,
        { reply_markup: createMainMenuKeyboard() }
    );
} 