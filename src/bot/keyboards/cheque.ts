import { InlineKeyboard } from "grammy";
import { UserCheque } from "../../entities/user-cheque";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatNumber } from "../utils/formatters";

/**
 * Creates inline keyboard for cheque details
 */
export function createChequeDetailKeyboard(cheque: UserCheque): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Add "Open Cheque" button if we have a link
    if (cheque.link) {
        keyboard.url("🔗 Open Cheque", cheque.link);
        keyboard.row();
    }
    
    keyboard.text("🎫 My Cheques", "history_cheques");
    keyboard.row();
    keyboard.text("🏠 Main Menu", "main_menu");
    
    return keyboard;
}

/**
 * Creates keyboard for cheque list with pagination
 */
export function createChequesKeyboard(cheques: UserCheque[], totalCount: number = 0, page: number = 0): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Add cheque buttons
    cheques.forEach((cheque, index) => {
        const currencyConfig = CurrencyConverter.getConfig(cheque.currency as InternalCurrency);
        const status = getChequeStatusEmoji(cheque.status);
        const buttonText = `${status} ${currencyConfig.emoji} ${formatNumber(cheque.amount)} ${currencyConfig.name} (ID: ${cheque.id})`;
        
        keyboard.text(buttonText, `cheque_${cheque.id}`);
        
        // Add new row for each cheque (except last one)
        if (index < cheques.length - 1) {
            keyboard.row();
        }
    });
    
    // Add pagination controls if needed
    const pageSize = 5;
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages > 1) {
        keyboard.row();
        
        if (page > 0) {
            keyboard.text("⬅️ Previous", `cheques_page_${page - 1}`);
        }
        
        keyboard.text(`📄 ${page + 1}/${totalPages}`, "cheques_page_info");
        
        if (page < totalPages - 1) {
            keyboard.text("Next ➡️", `cheques_page_${page + 1}`);
        }
    }
    
    // Add back button
    keyboard.row().text("📊 Back to Withdrawals", "my_withdrawals");
    keyboard.row().text("🏠 Main Menu", "main_menu");
    
    return keyboard;
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