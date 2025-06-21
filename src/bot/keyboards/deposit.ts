import { InlineKeyboard } from "grammy";
import { CURRENCIES } from "../../types/currency";

/**
 * Creates inline keyboard for coin selection
 */
export function createCoinSelectionKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text(`${CURRENCIES.TON.emoji} ${CURRENCIES.TON.name}`, "coin_TON")
        .text(`${CURRENCIES.USDT.emoji} ${CURRENCIES.USDT.name}`, "coin_USDT")
        .row()
        .text(`${CURRENCIES.XROCK.emoji} ${CURRENCIES.XROCK.name}`, "coin_XROCK");
}

/**
 * Creates inline keyboard for deposit success
 */
export function createDepositSuccessKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text("💰 Check Balance", "balance")
        .text("📋 My Invoices", "invoices")
        .row()
        .text("🏠 Main Menu", "main_menu");
} 