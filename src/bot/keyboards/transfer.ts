import { InlineKeyboard } from "grammy";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";

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