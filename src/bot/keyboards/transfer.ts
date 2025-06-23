import { InlineKeyboard } from "grammy";
import { UserTransfer } from "../../entities/user-transfer";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatNumber } from "../utils/formatters";

/**
 * Creates keyboard for transfer currency selection
 */
export function createTransferCurrencyKeyboard(): InlineKeyboard {
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
    keyboard.row().text("🏠 Main Menu", "main_menu");
    
    return keyboard;
}

/**
 * Creates keyboard for transfer list with pagination
 */
export function createTransfersKeyboard(transfers: UserTransfer[], totalCount: number = 0, page: number = 0): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Add transfer buttons
    transfers.forEach((transfer, index) => {
        const currencyConfig = CurrencyConverter.getConfig(transfer.currency as InternalCurrency);
        const buttonText = `🔄 ${currencyConfig.emoji} ${formatNumber(transfer.amount)} ${currencyConfig.name} → ${transfer.recipientTelegramId} (ID: ${transfer.id})`;
        
        keyboard.text(buttonText, `transfer_detail_${transfer.id}`);
        
        // Add new row for each transfer (except last one)
        if (index < transfers.length - 1) {
            keyboard.row();
        }
    });
    
    // Add pagination controls if needed
    const pageSize = 5;
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages > 1) {
        keyboard.row();
        
        if (page > 0) {
            keyboard.text("⬅️ Previous", `transfers_page_${page - 1}`);
        }
        
        keyboard.text(`📄 ${page + 1}/${totalPages}`, "transfers_page_info");
        
        if (page < totalPages - 1) {
            keyboard.text("Next ➡️", `transfers_page_${page + 1}`);
        }
    }
    
    // Add back button
    keyboard.row().text("📊 Back to Withdrawals", "my_withdrawals");
    keyboard.row().text("🏠 Main Menu", "main_menu");
    
    return keyboard;
}

/**
 * Creates keyboard for transfer detail view
 */
export function createTransferDetailKeyboard(transfer: UserTransfer): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    keyboard.text("📊 Back to Transfers", "history_transfers");
    keyboard.row();
    keyboard.text("🏠 Main Menu", "main_menu");
    
    return keyboard;
} 