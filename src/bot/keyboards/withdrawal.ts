import { InlineKeyboard } from "grammy";
import { UserWithdrawal } from "../../entities/user-withdrawal";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatCurrency } from "../utils/formatters";
import { BotContext } from "../../types/bot";

/**
 * Creates keyboard for withdrawal list with pagination
 */
export function createWithdrawalsKeyboard(withdrawals: UserWithdrawal[], totalWithdrawals: number, page: number, ctx: BotContext): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const totalPages = Math.ceil(totalWithdrawals / 5);

    // Add withdrawal buttons
    withdrawals.forEach((withdrawal, index) => {
        const currencyConfig = CurrencyConverter.getConfig(withdrawal.currency as InternalCurrency);
        const status = getStatusEmoji(withdrawal.status);
        const buttonText = `${status} ${currencyConfig.emoji} ${formatCurrency(withdrawal.amount)} ${currencyConfig.name} (ID: ${withdrawal.id})`;
        
        keyboard.text(buttonText, `withdrawal_${withdrawal.id}`);
        
        // Add new row for each withdrawal (except last one)
        if (index < withdrawals.length - 1) {
            keyboard.row();
        }
    });
    
    // Add pagination controls if needed
    if (totalPages > 1) {
        const navRow: any[] = [];
        
        if (page > 0) {
            navRow.push({ text: ctx.t('pagination-previous'), callback_data: `withdrawals_page_${page - 1}` });
        }
        
        navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: "withdrawals_page_info" });
        
        if (page < totalPages - 1) {
            navRow.push({ text: ctx.t('pagination-next'), callback_data: `withdrawals_page_${page + 1}` });
        }
        
        keyboard.row(...navRow);
    }
    
    // Add back button
    keyboard.row().text(ctx.t('buttons-main-menu'), "main_menu");
    
    return keyboard;
}

/**
 * Creates keyboard for withdrawal detail view
 */
export function createWithdrawalDetailKeyboard(withdrawal: UserWithdrawal, ctx: BotContext): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Add "Check Status" button for pending/processing withdrawals
    if (withdrawal.status === 'CREATED' || withdrawal.status === 'COMPLETED') {
        keyboard.text(ctx.t('withdrawals-check-status'), `check_withdrawal_${withdrawal.id}`);
        keyboard.row();
    }
    
    // Add "View Transaction" button if we have a transaction link
    if (withdrawal.txLink) {
        keyboard.url(ctx.t('withdrawals-view-transaction'), withdrawal.txLink);
        keyboard.row();
    }
    
    keyboard.text(ctx.t('withdrawals-back-to-withdrawals'), "my_withdrawals");
    keyboard.row();
    keyboard.text(ctx.t('buttons-main-menu'), "main_menu");
    
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
export function createWithdrawalHistoryMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
        .text(ctx.t('buttons-transfers'), "history_transfers")
        .row()
        .text(ctx.t('buttons-cheques'), "history_cheques")
        .row()
        .text(ctx.t('buttons-external'), "history_withdrawals")
        .row()
        .text(ctx.t('buttons-main-menu'), "main_menu");
} 