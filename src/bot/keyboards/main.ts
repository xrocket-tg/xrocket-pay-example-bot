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

/**
 * Creates a simple "Main Menu" button for error messages
 */
export function createMainMenuButton(): InlineKeyboard {
    return new InlineKeyboard()
        .text("🏠 Main Menu", "main_menu");
}

/**
 * Creates inline keyboard for withdraw submenu
 */
export function createWithdrawMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text("🔁 Transfer", "withdraw_transfer")
        .row()
        .text("🧾 Cheque", "withdraw_multicheque")
        .row()
        .text("🌐 External Wallet", "withdraw_external")
        .row()
        .text("🏠 Main Menu", "main_menu");
} 