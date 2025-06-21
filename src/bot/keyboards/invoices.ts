import { InlineKeyboard } from "grammy";
import { UserInvoice } from "../../entities/user-invoice";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatNumber } from "../utils/formatters";

/**
 * Creates keyboard for invoice list with pagination
 */
export function createInvoicesKeyboard(invoices: UserInvoice[], page: number = 0, pageSize: number = 5, totalCount: number = 0): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Add invoice buttons
    invoices.forEach((invoice, index) => {
        const currencyConfig = CurrencyConverter.getConfig(invoice.currency as InternalCurrency);
        const status = getStatusEmoji(invoice.status);
        const buttonText = `${status} ${currencyConfig.emoji} ${formatNumber(invoice.amount)} ${currencyConfig.name} (ID: ${invoice.invoiceId || 'N/A'})`;
        
        keyboard.text(buttonText, `invoice_${invoice.invoiceId}`);
        
        // Add new row for each invoice (except last one)
        if (index < invoices.length - 1) {
            keyboard.row();
        }
    });
    
    // Add pagination controls if needed
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages > 1) {
        keyboard.row();
        
        if (page > 0) {
            keyboard.text("⬅️ Previous", `invoices_page_${page - 1}`);
        }
        
        keyboard.text(`📄 ${page + 1}/${totalPages}`, "invoices_page_info");
        
        if (page < totalPages - 1) {
            keyboard.text("Next ➡️", `invoices_page_${page + 1}`);
        }
    }
    
    // Add back button
    keyboard.row().text("🏠 Main Menu", "main_menu");
    
    return keyboard;
}

/**
 * Creates keyboard for invoice detail view
 */
export function createInvoiceDetailKeyboard(invoice: UserInvoice): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Only show Pay Now and Check Payment for active invoices
    if (invoice.paymentUrl && invoice.status === 'active') {
        keyboard.url("💳 Pay Now", invoice.paymentUrl);
        keyboard.row();
        keyboard.text("🔄 Check Payment", `check_payment_${invoice.invoiceId}`);
        keyboard.row();
    }
    
    // Add delete button for non-paid invoices (including expired)
    if (invoice.status !== 'paid') {
        keyboard.text("🗑️ Delete Invoice", `delete_invoice_${invoice.invoiceId}`);
        keyboard.row();
    }
    
    keyboard.text("📋 Back to Invoices", "my_invoices");
    keyboard.row();
    keyboard.text("🏠 Main Menu", "main_menu");
    
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