import { InlineKeyboard } from "grammy";
import { UserWithdrawal } from "../../entities/user-withdrawal";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatNumber } from "../utils/formatters";

/**
 * Creates keyboard for withdrawal list with pagination
 */
export function createWithdrawalsKeyboard(withdrawals: UserWithdrawal[], totalCount: number = 0, page: number = 0): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Add withdrawal buttons
    withdrawals.forEach((withdrawal, index) => {
        const currencyConfig = CurrencyConverter.getConfig(withdrawal.currency as InternalCurrency);
        const status = getStatusEmoji(withdrawal.status);
        const buttonText = `${status} ${currencyConfig.emoji} ${formatNumber(withdrawal.amount)} ${currencyConfig.name} (ID: ${withdrawal.id})`;
        
        keyboard.text(buttonText, `withdrawal_${withdrawal.id}`);
        
        // Add new row for each withdrawal (except last one)
        if (index < withdrawals.length - 1) {
            keyboard.row();
        }
    });
    
    // Add pagination controls if needed
    const pageSize = 5;
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages > 1) {
        keyboard.row();
        
        if (page > 0) {
            keyboard.text("⬅️ Previous", `withdrawals_page_${page - 1}`);
        }
        
        keyboard.text(`📄 ${page + 1}/${totalPages}`, "withdrawals_page_info");
        
        if (page < totalPages - 1) {
            keyboard.text("Next ➡️", `withdrawals_page_${page + 1}`);
        }
    }
    
    // Add back button
    keyboard.row().text("🏠 Main Menu", "main_menu");
    
    return keyboard;
}

/**
 * Creates keyboard for withdrawal detail view
 */
export function createWithdrawalDetailKeyboard(withdrawal: UserWithdrawal): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Add "Check Status" button for pending/processing withdrawals
    if (withdrawal.status === 'CREATED' || withdrawal.status === 'COMPLETED') {
        keyboard.text("🔄 Check Status", `check_withdrawal_${withdrawal.id}`);
        keyboard.row();
    }
    
    // Add "View Transaction" button if we have a transaction link
    if (withdrawal.txLink) {
        keyboard.url("🔗 View Transaction", withdrawal.txLink);
        keyboard.row();
    }
    
    keyboard.text("📊 Back to Withdrawals", "my_withdrawals");
    keyboard.row();
    keyboard.text("🏠 Main Menu", "main_menu");
    
    return keyboard;
}

/**
 * Get status emoji for withdrawal status
 */
function getStatusEmoji(status: string): string {
    switch (status) {
        case 'CREATED': return '⏳';
        case 'COMPLETED': return '✅';
        case 'FAIL': return '❌';
        default: return '❓';
    }
}

/**
 * Creates keyboard for withdrawal history menu
 */
export function createWithdrawalHistoryMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text("🔄 My Transfers", "history_transfers")
        .row()
        .text("🎫 My Cheques", "history_cheques")
        .row()
        .text("🌐 My Blockchain Withdrawals", "history_withdrawals")
        .row()
        .text("🏠 Main Menu", "main_menu");
} 