import { InlineKeyboard } from "grammy";

/**
 * Creates inline keyboard for main menu
 */
export function createMainMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text("💰 Deposit", "deposit")
        .text("💸 Withdraw", "withdraw")
        .row()
        .text("📋 My Invoices", "my_invoices")
        .row()
        .text("📊 My Withdrawals", "my_withdrawals");
} 