import { Context, SessionFlavor } from "grammy";
import { ConversationFlavor } from "@grammyjs/conversations";
import { I18nFlavor } from "@grammyjs/i18n";
import { InternalCurrency } from "./currency";

/**
 * Session data interface for the bot
 */
export interface SessionData {
    step?: string;
    selectedCoin?: InternalCurrency;
    amount?: number;
    messageId?: number;
    invoiceId?: string;
    transferAmount?: number;
    recipientId?: number;
    transferRecipientId?: number;
    multichequeAmount?: number;
    // External withdrawal flow fields
    withdrawalAmount?: number;
    withdrawalNetwork?: string;
    withdrawalAddress?: string;
    withdrawalFee?: number;
}

/**
 * Base context type without conversation flavor
 */
export type BaseContext = Context & SessionFlavor<SessionData>;

/**
 * Bot context type with session data, conversation support, and i18n support
 */
export type BotContext = BaseContext & ConversationFlavor & I18nFlavor; 