import { InlineKeyboard } from "grammy";
import { UserInvoice } from "../../entities/user-invoice";
import { BotContext } from "../../types/bot";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatCurrency } from "../utils/formatters";

/**
 * Creates keyboard for invoice list with pagination
 */
export function createInvoicesKeyboard(invoices: UserInvoice[], totalInvoices: number, page: number, ctx: BotContext): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const totalPages = Math.ceil(totalInvoices / 5);

    // Add invoice buttons - each in its own row
    invoices.forEach((invoice, index) => {
        const currencyConfig = CurrencyConverter.getConfig(invoice.currency as InternalCurrency);
        const statusEmoji = invoice.status === 'paid' ? '✅' : invoice.status === 'expired' ? '❌' : '⏳';
        const buttonText = `${statusEmoji} ${currencyConfig.emoji} ${formatCurrency(invoice.amount)} ${currencyConfig.name} (ID: ${invoice.id})`;
        
        keyboard.text(buttonText, `invoice_${invoice.id}`);
        
        // Add new row for each invoice (except last one)
        if (index < invoices.length - 1) {
            keyboard.row();
        }
    });

    // Add pagination controls if needed
    if (totalPages > 1) {
        keyboard.row();
        
        if (page > 0) {
            keyboard.text(ctx.t('pagination-previous'), `invoices_page_${page - 1}`);
        }
        
        keyboard.text(`📄 ${page + 1}/${totalPages}`, "invoices_page_info");
        
        if (page < totalPages - 1) {
            keyboard.text(ctx.t('pagination-next'), `invoices_page_${page + 1}`);
        }
    }

    // Add back button
    keyboard.row().text(ctx.t('buttons-main-menu'), "main_menu");
    
    return keyboard;
}

/**
 * Creates keyboard for invoice detail view
 */
export function createInvoiceDetailKeyboard(invoice: UserInvoice, ctx: BotContext): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Add payment URL if available and invoice is active
    if (invoice.paymentUrl && invoice.status === 'active') {
        keyboard.url(ctx.t('invoices-pay-now'), invoice.paymentUrl);
        keyboard.row();
    }

    // Add action buttons based on invoice status
    if (invoice.status === 'active') {
        keyboard.text(ctx.t('invoices-check-payment'), `check_payment_${invoice.id}`);
        keyboard.row();
    }

    // Add delete button for non-paid invoices (including expired)
    if (invoice.status !== 'paid') {
        keyboard.text(ctx.t('invoices-delete'), `delete_invoice_${invoice.id}`);
        keyboard.row();
    }

    // Navigation
    keyboard.row()
        .text(ctx.t('invoices-back-to-list'), "my_invoices")
        .text(ctx.t('buttons-main-menu'), "main_menu");

    return keyboard;
}

/**
 * Get status emoji for invoice status
 */
function getStatusEmoji(status: string): string {
    switch (status) {
        case 'active': return '⏳';
        case 'paid': return '✅';
        case 'expired': return '❌';
        default: return '❓';
    }
} 