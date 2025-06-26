import { BotContext } from "../../types/bot";
import { createMainMenuButton } from "../keyboards/main";
import logger from "../../utils/logger";
import { formatCurrency } from "./formatters";

/**
 * Error types for different scenarios
 */
export enum ErrorType {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    API_ERROR = 'API_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    SESSION_ERROR = 'SESSION_ERROR',
    MESSAGE_ERROR = 'MESSAGE_ERROR',
    CALLBACK_ERROR = 'CALLBACK_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Error context for better debugging
 */
export interface ErrorContext {
    conversation?: string;
    step?: string;
    userId?: number;
    chatId?: number;
    action?: string;
    data?: any;
    sessionData?: any;
    messageType?: string;
    callbackData?: string;
    messageText?: string;
    timestamp?: string;
}

/**
 * Error Handler service for bot conversations
 * Centralizes all error handling logic to reduce code duplication
 */
export class ErrorHandler {
    private static instance: ErrorHandler;

    private constructor() {}

    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Safely answers a callback query, handling cases where it might be too old
     * @param ctx - The bot context
     * @param text - Optional text to show (default: empty string)
     */
    public async safeAnswerCallbackQuery(ctx: BotContext, text: string = ''): Promise<void> {
        if (!ctx.callbackQuery) {
            return;
        }

        try {
            await ctx.api.answerCallbackQuery(ctx.callbackQuery.id, { text });
        } catch (error) {
            // Log the error but don't throw - callback query might be too old
            logger.warn('[ErrorHandler] Failed to answer callback query:', {
                error: error instanceof Error ? error.message : error,
                callbackQueryId: ctx.callbackQuery.id,
                userId: ctx.from?.id,
                chatId: ctx.chat?.id
            });
            // Don't re-throw the error as it's not critical
        }
    }

    /**
     * Handles conversation errors with session clearing and user feedback
     * @param ctx - The bot context
     * @param error - The error that occurred
     * @param errorType - The type of error
     * @param context - Additional error context
     * @param sessionFields - Session fields to clear
     */
    public async handleConversationError(
        ctx: BotContext,
        error: Error | unknown,
        errorType: ErrorType = ErrorType.UNKNOWN_ERROR,
        context: ErrorContext = {},
        sessionFields: string[] = []
    ): Promise<void> {
        const errorMessage = this.formatErrorMessage(error);
        const logContext = this.buildLogContext(ctx, errorType, context);

        // Log the error with context
        this.logError(error, errorType, logContext);

        // Clear session fields if provided
        if (sessionFields.length > 0) {
            this.clearSessionFields(ctx, sessionFields);
        }

        // Send user-friendly error message
        await this.sendUserErrorMessage(ctx, errorType, errorMessage);
    }

    /**
     * Handles API errors specifically (like xRocket Pay API errors)
     * @param ctx - The bot context
     * @param error - The API error
     * @param context - Additional error context
     * @param sessionFields - Session fields to clear
     */
    public async handleApiError(
        ctx: BotContext,
        error: any,
        context: ErrorContext = {},
        sessionFields: string[] = []
    ): Promise<void> {
        const errorMessage = this.formatApiErrorMessage(error);
        const logContext = this.buildLogContext(ctx, ErrorType.API_ERROR, context);

        // Log API error details
        this.logApiError(error, logContext);

        // Clear session fields if provided
        if (sessionFields.length > 0) {
            this.clearSessionFields(ctx, sessionFields);
        }

        // Send user-friendly API error message
        await this.sendUserErrorMessage(ctx, ErrorType.API_ERROR, errorMessage);
    }

    /**
     * Handles validation errors
     * @param ctx - The bot context
     * @param error - The validation error
     * @param context - Additional error context
     */
    public async handleValidationError(
        ctx: BotContext,
        error: Error | string,
        context: ErrorContext = {}
    ): Promise<void> {
        const errorMessage = typeof error === 'string' ? error : error.message;
        const logContext = this.buildLogContext(ctx, ErrorType.VALIDATION_ERROR, context);

        // Log validation error
        this.logError(error, ErrorType.VALIDATION_ERROR, logContext);

        // Send user-friendly validation error message
        await this.sendUserErrorMessage(ctx, ErrorType.VALIDATION_ERROR, errorMessage);
    }

    /**
     * Handles session errors (missing session data, invalid state)
     * @param ctx - The bot context
     * @param error - The session error
     * @param context - Additional error context
     * @param sessionFields - Session fields to clear
     */
    public async handleSessionError(
        ctx: BotContext,
        error: Error | string,
        context: ErrorContext = {},
        sessionFields: string[] = []
    ): Promise<void> {
        const errorMessage = typeof error === 'string' ? error : error.message;
        const logContext = this.buildLogContext(ctx, ErrorType.SESSION_ERROR, context);

        // Log session error
        this.logError(error, ErrorType.SESSION_ERROR, logContext);

        // Clear session fields if provided
        if (sessionFields.length > 0) {
            this.clearSessionFields(ctx, sessionFields);
        }

        // Send user-friendly session error message
        await this.sendUserErrorMessage(ctx, ErrorType.SESSION_ERROR, errorMessage);
    }

    /**
     * Extracts clean error information from various error types
     * @param error - The error to extract information from
     * @returns Clean error information object
     */
    private extractCleanErrorInfo(error: any): any {
        if (!error || typeof error !== 'object') {
            return {
                type: 'unknown',
                message: String(error)
            };
        }

        // Handle Axios errors
        if ('response' in error) {
            const axiosError = error as any;
            const status = axiosError.response?.status;
            const statusText = axiosError.response?.statusText;
            const responseData = axiosError.response?.data;
            const requestData = axiosError.config?.data;
            const url = axiosError.config?.url;
            const method = axiosError.config?.method;

            return {
                type: 'axios_error',
                status,
                statusText,
                url,
                method,
                requestData: requestData ? JSON.parse(requestData) : undefined,
                responseData,
                validationErrors: responseData?.errors,
                apiMessage: responseData?.message,
                validationErrorCount: responseData?.errors?.length || 0,
                validationErrorTypes: responseData?.errors?.map((err: any) => err.property).filter(Boolean) || []
            };
        }

        // Handle standard Error objects
        if (error instanceof Error) {
            return {
                type: 'standard_error',
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }

        // Handle other objects
        return {
            type: 'object_error',
            message: error.message || 'Unknown error',
            data: error
        };
    }

    /**
     * Logs errors with consistent formatting
     * @param error - The error to log
     * @param errorType - The type of error
     * @param context - Additional context for logging
     */
    public logError(error: Error | unknown, errorType: ErrorType, context: ErrorContext = {}): void {
        const errorMessage = this.formatErrorMessage(error);
        let logLevel = 'error';
        let logMessage = `[${errorType}] ${errorMessage}`;
        
        // Determine log level based on error type
        switch (errorType) {
            case ErrorType.VALIDATION_ERROR:
                logLevel = 'warn';
                logMessage = `[${errorType}] Validation failed: ${errorMessage}`;
                break;
            case ErrorType.SESSION_ERROR:
                logLevel = 'warn';
                logMessage = `[${errorType}] Session error: ${errorMessage}`;
                break;
            case ErrorType.API_ERROR:
                logLevel = 'error';
                logMessage = `[${errorType}] API error: ${errorMessage}`;
                break;
            case ErrorType.DATABASE_ERROR:
                logLevel = 'error';
                logMessage = `[${errorType}] Database error: ${errorMessage}`;
                break;
            case ErrorType.NETWORK_ERROR:
                logLevel = 'error';
                logMessage = `[${errorType}] Network error: ${errorMessage}`;
                break;
            default:
                logLevel = 'error';
                logMessage = `[${errorType}] Unexpected error: ${errorMessage}`;
        }
        
        const cleanErrorInfo = this.extractCleanErrorInfo(error);
        const logData = {
            errorType,
            errorInfo: cleanErrorInfo,
            context,
            timestamp: new Date().toISOString()
        };
        
        // Use appropriate log level
        switch (logLevel) {
            case 'warn':
                logger.warn(logMessage, logData);
                break;
            case 'info':
                logger.info(logMessage, logData);
                break;
            default:
                logger.error(logMessage, logData);
        }
    }

    /**
     * Logs API errors with detailed information
     * @param error - The API error
     * @param context - Additional context for logging
     */
    public logApiError(error: any, context: ErrorContext = {}): void {
        const cleanErrorInfo = this.extractCleanErrorInfo(error);
        let logLevel = 'error';
        let logMessage = '[API_ERROR] API request failed';
        
        // Determine log level based on status code
        if (cleanErrorInfo.type === 'axios_error') {
            const status = cleanErrorInfo.status;
            if (status >= 500) {
                logLevel = 'error';
                logMessage = '[API_ERROR] Server error from xrocket-pay API';
            } else if (status >= 400) {
                logLevel = 'warn';
                logMessage = '[API_ERROR] Client error from xrocket-pay API';
            } else {
                logLevel = 'info';
                logMessage = '[API_ERROR] API request failed';
            }
        }

        const logData = {
            errorInfo: cleanErrorInfo,
            context,
            timestamp: new Date().toISOString()
        };

        // Use appropriate log level
        switch (logLevel) {
            case 'warn':
                logger.warn(logMessage, logData);
                break;
            case 'info':
                logger.info(logMessage, logData);
                break;
            default:
                logger.error(logMessage, logData);
        }
    }

    /**
     * Formats error messages for user display
     * @param error - The error to format
     * @returns Formatted error message
     */
    public formatErrorMessage(error: Error | unknown): string {
        if (error instanceof Error) {
            return this.formatNumbersInMessage(error.message);
        }
        
        if (typeof error === 'string') {
            return this.formatNumbersInMessage(error);
        }
        
        return 'An unexpected error occurred';
    }

    /**
     * Formats API error messages for user display
     * @param error - The API error
     * @returns Formatted API error message
     */
    public formatApiErrorMessage(error: any): string {
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as any;
            
            // Extract specific validation errors from xrocket-pay API
            if (axiosError.response?.data?.errors && Array.isArray(axiosError.response.data.errors)) {
                const errors = axiosError.response.data.errors;
                if (errors.length > 0) {
                    // Format validation errors for user display
                    const formattedErrors = errors.map((err: any) => {
                        if (err.property && err.error) {
                            // Convert property name to user-friendly format
                            const propertyName = this.formatPropertyName(err.property);
                            return `${propertyName}: ${err.error}`;
                        }
                        return err.error || err.message || 'Unknown validation error';
                    });
                    
                    return formattedErrors.join('\n');
                }
            }
            
            // Check for specific API error messages
            if (axiosError.response?.data?.message) {
                const apiMessage = axiosError.response.data.message;
                // If it's a generic "Bad request" message, try to get more specific info
                if (apiMessage.toLowerCase() === 'bad request' && axiosError.response?.data?.errors) {
                    return this.formatApiErrorMessage(error); // Recursive call to handle errors array
                }
                return `API Error: ${this.formatNumbersInMessage(apiMessage)}`;
            }
            
            // Check for HTTP status codes
            if (axiosError.response?.status) {
                switch (axiosError.response.status) {
                    case 400:
                        return 'Invalid request. Please check your input and try again.';
                    case 401:
                        return 'Authentication failed. Please try again later.';
                    case 403:
                        return 'Access denied. Please try again later.';
                    case 404:
                        return 'Service not found. Please try again later.';
                    case 429:
                        return 'Too many requests. Please wait a moment and try again.';
                    case 500:
                        return 'Server error. Please try again later.';
                    default:
                        return `Service temporarily unavailable (${axiosError.response.status}). Please try again later.`;
                }
            }
        }
        
        return 'Service temporarily unavailable. Please try again later.';
    }

    /**
     * Formats property names for user-friendly display
     * @param property - The property name from API
     * @returns User-friendly property name
     */
    private formatPropertyName(property: string): string {
        const propertyMap: Record<string, string> = {
            'address': 'Wallet Address',
            'amount': 'Amount',
            'currency': 'Currency',
            'network': 'Network',
            'withdrawalId': 'Withdrawal ID',
            'recipientId': 'Recipient ID',
            'telegramId': 'Telegram ID',
            'invoiceId': 'Invoice ID'
        };
        
        return propertyMap[property] || property.charAt(0).toUpperCase() + property.slice(1);
    }

    /**
     * Formats numbers in error messages to remove trailing zeros
     * @param message - The message to format
     * @returns Formatted message with clean numbers
     */
    private formatNumbersInMessage(message: string): string {
        // Regular expression to find numbers (including decimals) in the message
        // This will match patterns like: 100.05, 3.21000000, 100 + 0.05, etc.
        return message.replace(/(\d+\.\d+)/g, (match) => {
            try {
                return formatCurrency(parseFloat(match));
            } catch {
                return match; // Return original if parsing fails
            }
        });
    }

    /**
     * Builds log context from bot context and additional context
     * @param ctx - The bot context
     * @param errorType - The type of error
     * @param context - Additional context
     * @returns Log context object
     */
    private buildLogContext(ctx: BotContext, errorType: ErrorType, context: ErrorContext = {}): ErrorContext {
        const sessionData = ctx.session ? {
            step: ctx.session.step,
            selectedCoin: ctx.session.selectedCoin,
            transferAmount: ctx.session.transferAmount,
            recipientId: ctx.session.recipientId,
            multichequeAmount: ctx.session.multichequeAmount,
            withdrawalAmount: ctx.session.withdrawalAmount,
            withdrawalNetwork: ctx.session.withdrawalNetwork,
            withdrawalAddress: ctx.session.withdrawalAddress,
            withdrawalFee: ctx.session.withdrawalFee,
            invoiceId: ctx.session.invoiceId
        } : null;

        return {
            conversation: context.conversation || 'unknown',
            step: context.step || ctx.session?.step || 'unknown',
            userId: context.userId || ctx.from?.id,
            chatId: context.chatId || ctx.chat?.id,
            action: context.action || 'unknown',
            data: context.data || null,
            sessionData,
            messageType: ctx.callbackQuery ? 'callback_query' : ctx.message ? 'message' : 'unknown',
            callbackData: ctx.callbackQuery?.data,
            messageText: ctx.message?.text,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Clears specified session fields
     * @param ctx - The bot context
     * @param fields - Session fields to clear
     */
    private clearSessionFields(ctx: BotContext, fields: string[]): void {
        if (!ctx.session) {
            return;
        }

        fields.forEach(field => {
            if (field in ctx.session) {
                (ctx.session as any)[field] = undefined;
            }
        });

        logger.info('[ErrorHandler] Cleared session fields:', fields);
    }

    /**
     * Sends user-friendly error message with main menu button
     * @param ctx - The bot context
     * @param errorType - The type of error
     * @param errorMessage - The error message
     */
    private async sendUserErrorMessage(
        ctx: BotContext,
        errorType: ErrorType,
        errorMessage: string
    ): Promise<void> {
        try {
            // Always show simple main menu button with error messages
            const keyboard = createMainMenuButton();
            
            // Determine if we should edit message or send new message
            if (ctx.callbackQuery?.message) {
                await ctx.api.editMessageText(
                    ctx.chat!.id,
                    ctx.callbackQuery.message.message_id,
                    `❌ ${errorMessage}`,
                    { reply_markup: keyboard }
                );
            } else {
                await ctx.reply(
                    `❌ ${errorMessage}`,
                    { reply_markup: keyboard }
                );
            }
        } catch (sendError) {
            // If we can't send the error message, log it
            logger.error('[ErrorHandler] Failed to send error message to user:', {
                originalError: errorMessage,
                sendError: sendError instanceof Error ? sendError.message : sendError,
                errorType,
                userId: ctx.from?.id,
                chatId: ctx.chat?.id
            });
        }
    }

    /**
     * Gets user-friendly error message based on error type
     * @param errorType - The type of error
     * @returns User-friendly error message
     */
    public getUserFriendlyMessage(errorType: ErrorType): string {
        switch (errorType) {
            case ErrorType.VALIDATION_ERROR:
                return 'Invalid input. Please check your data and try again.';
            case ErrorType.API_ERROR:
                return 'Service temporarily unavailable. Please try again later.';
            case ErrorType.DATABASE_ERROR:
                return 'Database error. Please try again later.';
            case ErrorType.NETWORK_ERROR:
                return 'Network error. Please check your connection and try again.';
            case ErrorType.SESSION_ERROR:
                return 'Session expired. Please start over.';
            case ErrorType.UNKNOWN_ERROR:
            default:
                return 'An unexpected error occurred. Please try again.';
        }
    }

    /**
     * Handles errors during conversation flow with automatic session clearing
     * @param ctx - The bot context
     * @param error - The error that occurred
     * @param conversation - The conversation name
     * @param step - The current step
     */
    public async handleConversationFlowError(
        ctx: BotContext,
        error: Error | unknown,
        conversation: string,
        step?: string
    ): Promise<void> {
        const context: ErrorContext = {
            conversation,
            step: step || ctx.session?.step || 'unknown',
            action: 'conversation_flow'
        };

        // Clear all session fields for conversation flows
        const sessionFields = [
            'step',
            'selectedCoin',
            'transferAmount',
            'recipientId',
            'multichequeAmount',
            'withdrawalAmount',
            'withdrawalNetwork',
            'withdrawalAddress',
            'withdrawalFee',
            'invoiceId'
        ];

        await this.handleConversationError(ctx, error, ErrorType.UNKNOWN_ERROR, context, sessionFields);
    }
} 