import { BotContext } from "../../types/bot";
import { InlineKeyboard } from "grammy";
import { createMainMenuButton } from "../keyboards/main";
import { ErrorHandler, ErrorType } from "../utils/error-handler";
import { Api } from 'grammy';
import logger from "../../utils/logger";

/**
 * Message Service for handling Telegram bot message operations
 * Centralizes message editing, sending, and error display to reduce code duplication
 */
export class MessageService {
    private static instance: MessageService;
    private errorHandler: ErrorHandler;

    private constructor() {
        this.errorHandler = ErrorHandler.getInstance();
    }

    public static getInstance(): MessageService {
        if (!MessageService.instance) {
            MessageService.instance = new MessageService();
        }
        return MessageService.instance;
    }

    /**
     * Edits a message or sends a new one if editing fails
     * @param ctx - The bot context
     * @param message - The message to send
     * @param keyboard - Optional keyboard
     * @param options - Additional options
     */
    public async editMessage(
        ctx: BotContext,
        message: string,
        keyboard?: InlineKeyboard,
        options: {
            parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
            disableWebPagePreview?: boolean;
        } = {}
    ): Promise<void> {
        const { parseMode = 'HTML', disableWebPagePreview = false } = options;

        try {
            // Try to edit existing message if we have a callback query
            if (ctx.callbackQuery?.message) {
                await ctx.api.editMessageText(
                    ctx.chat!.id,
                    ctx.callbackQuery.message.message_id,
                    message,
                    {
                        reply_markup: keyboard,
                        parse_mode: parseMode,
                        disable_web_page_preview: disableWebPagePreview
                    } as any
                );
            } else {
                // Otherwise, send a new message
                await ctx.reply(message, {
                    reply_markup: keyboard,
                    parse_mode: parseMode,
                    disable_web_page_preview: disableWebPagePreview
                } as any);
            }
        } catch (error) {
            this.errorHandler.logError(error, ErrorType.MESSAGE_ERROR, {
                conversation: 'message_service',
                action: 'edit_message',
                data: { messageLength: message.length, hasKeyboard: !!keyboard }
            });
            
            // Fallback: try to send a new message
            try {
                await ctx.reply(message, {
                    reply_markup: keyboard,
                    parse_mode: parseMode,
                    disable_web_page_preview: disableWebPagePreview
                } as any);
            } catch (fallbackError) {
                this.errorHandler.logError(fallbackError, ErrorType.MESSAGE_ERROR, {
                    conversation: 'message_service',
                    action: 'fallback_reply',
                    data: { originalError: error instanceof Error ? error.message : 'Unknown error' }
                });
            }
        }
    }

    /**
     * Shows an error message with main menu button
     * @param ctx - The bot context
     * @param errorMessage - The error message to display
     * @param options - Additional options
     */
    public async showError(
        ctx: BotContext,
        errorMessage: string,
        options: {
            showMainMenu?: boolean;
            parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
        } = {}
    ): Promise<void> {
        const { showMainMenu = true, parseMode } = options;
        const keyboard = showMainMenu ? createMainMenuButton(ctx) : undefined;
        const formattedMessage = `<b>❌ Error</b>\n\n${this.escapeHtml(errorMessage)}`;
        
        await this.editMessage(ctx, formattedMessage, keyboard, { parseMode });
    }

    /**
     * Shows a success message with optional keyboard
     * @param ctx - The bot context
     * @param message - The success message
     * @param keyboard - Optional keyboard
     * @param options - Additional options
     */
    public async showSuccess(
        ctx: BotContext,
        message: string,
        keyboard?: InlineKeyboard,
        options: {
            parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
            showMainMenu?: boolean;
        } = {}
    ): Promise<void> {
        const { parseMode, showMainMenu = false } = options;
        const finalKeyboard = keyboard || (showMainMenu ? createMainMenuButton(ctx) : undefined);
        const formattedMessage = `<b>✅ Success</b>\n\n${this.escapeHtml(message)}`;
        
        await this.editMessage(ctx, formattedMessage, finalKeyboard, { parseMode });
    }

    /**
     * Shows an info message with optional keyboard
     * @param ctx - The bot context
     * @param message - The info message
     * @param keyboard - Optional keyboard
     * @param options - Additional options
     */
    public async showInfo(
        ctx: BotContext,
        message: string,
        keyboard?: InlineKeyboard,
        options: {
            parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
            showMainMenu?: boolean;
        } = {}
    ): Promise<void> {
        const { parseMode, showMainMenu = false } = options;
        const finalKeyboard = keyboard || (showMainMenu ? createMainMenuButton(ctx) : undefined);
        const formattedMessage = `<b>ℹ️ Info</b>\n\n${this.escapeHtml(message)}`;
        
        await this.editMessage(ctx, formattedMessage, finalKeyboard, { parseMode });
    }

    /**
     * Shows a warning message with optional keyboard
     * @param ctx - The bot context
     * @param message - The warning message
     * @param keyboard - Optional keyboard
     * @param options - Additional options
     */
    public async showWarning(
        ctx: BotContext,
        message: string,
        keyboard?: InlineKeyboard,
        options: {
            parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
            showMainMenu?: boolean;
        } = {}
    ): Promise<void> {
        const { parseMode, showMainMenu = false } = options;
        const finalKeyboard = keyboard || (showMainMenu ? createMainMenuButton(ctx) : undefined);
        const formattedMessage = `<b>⚠️ Warning</b>\n\n${this.escapeHtml(message)}`;
        
        await this.editMessage(ctx, formattedMessage, finalKeyboard, { parseMode });
    }

    /**
     * Shows a loading message (can be edited later)
     * @param ctx - The bot context
     * @param message - The loading message
     * @param keyboard - Optional keyboard
     */
    public async showLoading(
        ctx: BotContext,
        message: string = "⏳ Processing...",
        keyboard?: InlineKeyboard
    ): Promise<void> {
        await this.editMessage(ctx, message, keyboard);
    }

    /**
     * Answers a callback query safely with optional text
     * @param ctx - The bot context
     * @param text - Optional text to show
     */
    public async answerCallbackQuery(
        ctx: BotContext,
        text?: string
    ): Promise<void> {
        if (!ctx.callbackQuery) {
            return;
        }

        try {
            await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text });
        } catch (error) {
            // Log but don't throw - callback query might be too old
            this.errorHandler.logError(error, ErrorType.CALLBACK_ERROR, {
                conversation: 'message_service',
                action: 'answer_callback_query',
                data: { callbackQueryId: ctx.callbackQuery.id }
            });
        }
    }

    /**
     * Shows a confirmation dialog with Yes/No buttons
     * @param ctx - The bot context
     * @param message - The confirmation message
     * @param yesCallback - Callback data for Yes button
     * @param noCallback - Callback data for No button
     */
    public async showConfirmation(
        ctx: BotContext,
        message: string,
        yesCallback: string,
        noCallback: string
    ): Promise<void> {
        const keyboard = new InlineKeyboard()
            .text("✅ Yes", yesCallback)
            .text("❌ No", noCallback);
        
        await this.editMessage(ctx, message, keyboard);
    }

    /**
     * Shows a paginated list with navigation buttons
     * @param ctx - The bot context
     * @param message - The main message
     * @param currentPage - Current page number
     * @param totalPages - Total number of pages
     * @param pageCallback - Callback data pattern for page navigation
     * @param additionalButtons - Additional buttons to add
     */
    public async showPaginatedList(
        ctx: BotContext,
        message: string,
        currentPage: number,
        totalPages: number,
        pageCallback: string,
        additionalButtons: Array<{ text: string; callback_data: string }> = []
    ): Promise<void> {
        const keyboard = new InlineKeyboard();
        
        // Add navigation buttons
        if (totalPages > 1) {
            const navRow = [];
            
            if (currentPage > 0) {
                navRow.push({ text: "⬅️", callback_data: `${pageCallback}_${currentPage - 1}` });
            }
            
            navRow.push({ text: `${currentPage + 1}/${totalPages}`, callback_data: "noop" });
            
            if (currentPage < totalPages - 1) {
                navRow.push({ text: "➡️", callback_data: `${pageCallback}_${currentPage + 1}` });
            }
            
            keyboard.row(...navRow);
        }
        
        // Add additional buttons
        if (additionalButtons.length > 0) {
            keyboard.row(...additionalButtons);
        }
        
        // Add back button
        keyboard.text("🔙 Back", "main_menu");
        
        await this.editMessage(ctx, message, keyboard);
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
} 