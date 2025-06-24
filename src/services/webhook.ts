import { AppDataSource } from "../config/database";
import { UserInvoice } from "../entities/user-invoice";
import { UserService } from "./user";
import logger from "../utils/logger";
import { 
    InvoicePaymentWebhook
} from 'xrocket-pay-api-sdk/dist/types/webhook';
import { 
    verifyAndParseWebhook,
    isInvoicePaid,
    extractPaymentInfo,
    parseWebhookPayload
} from 'xrocket-pay-api-sdk/dist/webhook-utils';
import { CurrencyConverter } from "../types/currency";
import { Bot, InlineKeyboard } from "grammy";
import { BotContext } from "../types/bot";
import { TransactionService } from "./transaction";
import { ErrorHandler, ErrorType } from "../bot/utils/error-handler";

export class WebhookService {
    private static instance: WebhookService;
    private userService: UserService;
    private bot: Bot<BotContext>;
    private errorHandler: ErrorHandler;

    private constructor(bot: Bot<BotContext>) {
        this.userService = UserService.getInstance();
        this.bot = bot;
        this.errorHandler = ErrorHandler.getInstance();
    }

    public static getInstance(bot: Bot<BotContext>): WebhookService {
        if (!WebhookService.instance) {
            WebhookService.instance = new WebhookService(bot);
        }
        return WebhookService.instance;
    }

    /**
     * Handles invoice webhook events from xRocket Pay
     */
    public async handleInvoiceWebhook(
        body: string, 
        signature: string
    ): Promise<{ success: boolean; message: string }> {
        logger.info('[WebhookService] Processing invoice webhook');

        try {
            const secret = process.env.XROCKET_API_KEY;
            if (!secret) {
                logger.error('[WebhookService] App token not configured');
                return { success: false, message: 'App token not configured' };
            }

            // Verify signature and parse webhook payload
            const webhook = verifyAndParseWebhook(body, signature, secret);
            logger.info('[WebhookService] Webhook verified and parsed:', {
                type: webhook.type,
                invoiceId: webhook.data.id,
                status: webhook.data.status
            });

            // Process the webhook based on invoice status
            if (isInvoicePaid(webhook)) {
                return await this.handleInvoicePaid(webhook);
            } else if (webhook.data.status === 'expired') {
                return await this.handleInvoiceExpired(webhook);
            } else {
                logger.info('[WebhookService] Invoice status unchanged:', webhook.data.status);
                return { success: true, message: 'Invoice status unchanged' };
            }
        } catch (error) {
            this.errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'webhook_service',
                action: 'handle_invoice_webhook',
                data: { body: body.substring(0, 100) + '...' }
            });
            return { success: false, message: 'Error processing webhook' };
        }
    }

    /**
     * Handles paid invoice webhook event
     */
    private async handleInvoicePaid(webhook: InvoicePaymentWebhook): Promise<{ success: boolean; message: string }> {
        logger.info('[WebhookService] Processing paid invoice:', webhook.data.id);

        try {
            // Find invoice in database
            const invoiceRepo = AppDataSource.getRepository(UserInvoice);
            const invoice = await invoiceRepo.findOne({
                where: { invoiceId: webhook.data.id.toString() },
                relations: ['user']
            });

            if (!invoice) {
                logger.error('[WebhookService] Invoice not found in database:', webhook.data.id);
                return { success: false, message: 'Invoice not found' };
            }

            // Check if invoice is already paid
            if (invoice.status === 'paid') {
                logger.info('[WebhookService] Invoice already marked as paid:', webhook.data.id);
                return { success: true, message: 'Invoice already paid' };
            }

            // Extract payment information
            const paymentInfo = extractPaymentInfo(webhook);
            logger.info('[WebhookService] Payment info:', paymentInfo);

            // Update invoice amount with actual payment amount if different
            if (paymentInfo.paymentAmount !== parseFloat(invoice.amount.toString())) {
                await invoiceRepo.update(invoice.id, { amount: paymentInfo.paymentAmount });
            }

            // Process invoice payment via TransactionService (ensures transaction safety)
            const transactionService = TransactionService.getInstance();
            await transactionService.processInvoicePayment(invoice);

            logger.info('[WebhookService] Successfully processed paid invoice:', webhook.data.id);

            // Notify user about successful payment
            const formattedAmount = parseFloat(invoice.amount.toString());
            const internalCurrency = CurrencyConverter.toInternal(webhook.data.currency as any);
            const keyboard = new InlineKeyboard().text("🏠 Main Menu", "main_menu");
            await this.bot.api.sendMessage(
                invoice.user.telegramId,
                `You successfully deposited ${formattedAmount} ${internalCurrency}!`,
                {
                    reply_markup: keyboard,
                },
            );

            return { success: true, message: 'Invoice paid successfully' };
        } catch (error) {
            this.errorHandler.logError(error, ErrorType.DATABASE_ERROR, {
                conversation: 'webhook_service',
                action: 'handle_invoice_paid',
                data: { invoiceId: webhook.data.id }
            });
            throw error;
        }
    }

    /**
     * Handles expired invoice webhook event
     */
    private async handleInvoiceExpired(webhook: InvoicePaymentWebhook): Promise<{ success: boolean; message: string }> {
        logger.info('[WebhookService] Processing expired invoice:', webhook.data.id);

        try {
            // Find and update invoice status
            const invoiceRepo = AppDataSource.getRepository(UserInvoice);
            const invoice = await invoiceRepo.findOne({
                where: { invoiceId: webhook.data.id.toString() }
            });

            if (!invoice) {
                logger.error('[WebhookService] Invoice not found in database:', webhook.data.id);
                return { success: false, message: 'Invoice not found' };
            }

            // Update invoice status
            await invoiceRepo.update(invoice.id, {
                status: 'expired',
                updatedAt: new Date()
            });

            logger.info('[WebhookService] Successfully processed expired invoice:', webhook.data.id);
            return { success: true, message: 'Invoice expired successfully' };
        } catch (error) {
            this.errorHandler.logError(error, ErrorType.DATABASE_ERROR, {
                conversation: 'webhook_service',
                action: 'handle_invoice_expired',
                data: { invoiceId: webhook.data.id }
            });
            throw error;
        }
    }

    /**
     * Validates webhook payload structure using SDK utilities
     */
    public validateWebhookPayload(payload: any): payload is InvoicePaymentWebhook {
        try {
            // Use SDK's parse function to validate
            parseWebhookPayload(JSON.stringify(payload));
            return true;
        } catch {
            return false;
        }
    }
} 