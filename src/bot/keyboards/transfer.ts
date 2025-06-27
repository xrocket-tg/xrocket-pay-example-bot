import { InlineKeyboard } from "grammy";
import { UserTransfer } from "../../entities/user-transfer";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatCurrency } from "../utils/formatters";
import { BotContext } from "../../types/bot";

/**
 * Creates keyboard for transfer currency selection
 */
export function createTransferCurrencyKeyboard(ctx: BotContext): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const currencies = CurrencyConverter.getSupportedInternalCodes();
    
    // Add currency buttons
    currencies.forEach((currency, index) => {
        const currencyConfig = CurrencyConverter.getConfig(currency);
        keyboard.text(
            `${currencyConfig.emoji} ${currencyConfig.name}`,
            `transfer_coin_${currency}`
        );
        
        // Add new row for each currency (except last one)
        if (index < currencies.length - 1) {
            keyboard.row();
        }
    });
    
    // Add back button
    keyboard.row().text(ctx.t('buttons-main-menu'), "main_menu");
    
    return keyboard;
}

/**
 * Creates keyboard for transfer list with pagination
 */
export function createTransfersKeyboard(transfers: UserTransfer[], totalTransfers: number, page: number, ctx: BotContext): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const totalPages = Math.ceil(totalTransfers / 5);

    // Add transfer buttons
    transfers.forEach((transfer, index) => {
        const statusEmoji = transfer.status === 'completed' ? '✅' : transfer.status === 'failed' ? '❌' : '⏳';
        keyboard.text(
            `${statusEmoji} ${transfer.amount} ${transfer.currency}`,
            `transfer_${transfer.id}`
        );
    });

    // Add pagination
    if (totalPages > 1) {
        const navRow: any[] = [];
        
        if (page > 0) {
            navRow.push({ text: ctx.t('pagination-previous'), callback_data: `transfers_page_${page - 1}` });
        }
        
        navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: "transfers_page_info" });
        
        if (page < totalPages - 1) {
            navRow.push({ text: ctx.t('pagination-next'), callback_data: `transfers_page_${page + 1}` });
        }
        
        keyboard.row(...navRow);
    }

    keyboard.row()
        .text(ctx.t('withdrawals-back-to-list'), "my_withdrawals")
        .text(ctx.t('buttons-main-menu'), "main_menu");
    return keyboard;
}

/**
 * Creates keyboard for transfer detail view
 */
export function createTransferDetailKeyboard(transfer: UserTransfer, ctx: BotContext): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Navigation
    keyboard.row()
        .text(ctx.t('transfers-back-to-list'), "history_transfers")
        .text(ctx.t('buttons-main-menu'), "main_menu");

    return keyboard;
} 