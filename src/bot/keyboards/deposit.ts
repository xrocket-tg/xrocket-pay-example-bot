import { InlineKeyboard } from "grammy";
import { CurrencyConverter } from "../../types/currency";
import { BotContext } from "../../types/bot";

/**
 * Creates inline keyboard for coin selection
 */
export function createCoinSelectionKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const codes = CurrencyConverter.getSupportedInternalCodes();
    codes.forEach((code, idx) => {
        const config = CurrencyConverter.getConfig(code);
        keyboard.text(`${config.emoji} ${config.name}`, `coin_${code}`);
        if ((idx + 1) % 2 === 0 && idx !== codes.length - 1) {
            keyboard.row();
        }
    });
    return keyboard;
} 