import { InlineKeyboard } from "grammy";
import { BotContext } from "../../types/bot";

/**
 * Creates inline keyboard for main menu
 */
export function createMainMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
        .text(ctx.t('buttons-deposit'), "deposit")
        .text(ctx.t('buttons-withdraw'), "withdraw")
        .row()
        .text(ctx.t('buttons-invoices'), "my_invoices")
        .row()
        .text(ctx.t('buttons-withdrawals'), "my_withdrawals");
}

/**
 * Creates a simple "Main Menu" button for error messages
 */
export function createMainMenuButton(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
        .text(ctx.t('buttons-main-menu'), "main_menu");
}

/**
 * Creates inline keyboard for withdraw submenu
 */
export function createWithdrawMenuKeyboard(ctx: BotContext): InlineKeyboard {
    return new InlineKeyboard()
        .text(ctx.t('buttons-transfer'), "withdraw_transfer")
        .row()
        .text(ctx.t('buttons-multicheque'), "withdraw_multicheque")
        .row()
        .text(ctx.t('buttons-blockchain-transfer'), "withdraw_external")
        .row()
        .text(ctx.t('buttons-main-menu'), "main_menu");
} 