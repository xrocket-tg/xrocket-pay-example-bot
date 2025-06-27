import { InlineKeyboard } from "grammy";
import { UserCheque } from "../../entities/user-cheque";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatCurrency } from "../utils/formatters";
import { BotContext } from "../../types/bot";

/**
 * Creates inline keyboard for cheque details
 */
export function createChequeDetailKeyboard(cheque: UserCheque, ctx: BotContext): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Add "Open Cheque" button if we have a link
    if (cheque.link) {
        keyboard.url(ctx.t('cheques-open-cheque'), cheque.link);
        keyboard.row();
    }
    
    keyboard.text(ctx.t('cheques-back-to-list'), "history_cheques");
    keyboard.row();
    keyboard.text(ctx.t('buttons-main-menu'), "main_menu");
    
    return keyboard;
}

/**
 * Creates keyboard for cheque list with pagination
 */
export function createChequesKeyboard(cheques: UserCheque[], totalCheques: number, page: number, ctx: BotContext): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const totalPages = Math.ceil(totalCheques / 5);

    // Add cheque buttons
    cheques.forEach((cheque, index) => {
        const currencyConfig = CurrencyConverter.getConfig(cheque.currency as InternalCurrency);
        const status = getChequeStatusEmoji(cheque.status);
        const buttonText = `${status} ${currencyConfig.emoji} ${formatCurrency(cheque.amount)} ${currencyConfig.name} (ID: ${cheque.id})`;
        
        keyboard.text(buttonText, `cheque_${cheque.id}`);
        
        // Add new row for each cheque (except last one)
        if (index < cheques.length - 1) {
            keyboard.row();
        }
    });
    
    // Add pagination controls if needed
    if (totalPages > 1) {
        const navRow: any[] = [];
        
        if (page > 0) {
            navRow.push({ text: ctx.t('pagination-previous'), callback_data: `cheques_page_${page - 1}` });
        }
        
        navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: "cheques_page_info" });
        
        if (page < totalPages - 1) {
            navRow.push({ text: ctx.t('pagination-next'), callback_data: `cheques_page_${page + 1}` });
        }
        
        keyboard.row(...navRow);
    }
    
    // Add back button
    keyboard.row()
        .text(ctx.t('withdrawals-back-to-list'), "my_withdrawals");
    keyboard.row()
        .text(ctx.t('buttons-main-menu'), "main_menu");
    
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