import express, { Request, Response } from 'express';
import { Bot, session } from "grammy";
import { BotContext } from "./types/bot";
import { AppDataSource } from "./config/database";
import { handleStart } from "./bot/handlers/commands";
import { handleBalance, handleCheckPayment, handleInvoices, handleInvoiceDetail, handleInvoicePagination, handleDeleteInvoice, handleMainMenu, handleWithdraw, handleMyWithdrawals, handleWithdrawTransfer, handleWithdrawMulticheque, handleWithdrawExternal, handleOpenCheque, handleWithdrawalDetail, handleCheckWithdrawalStatus, handleHistoryTransfers, handleHistoryCheques, handleHistoryWithdrawals, handleTransferPagination, handleChequePagination, handleWithdrawalPagination, handleChequeDetail, handleTransferDetail } from "./bot/handlers/callbacks";
import { handleDepositFlow, handleCurrencySelection, handleAmountInput } from "./bot/conversations/deposit";
import { handleTransferFlow, handleTransferCurrencySelection, handleTransferAmountInput, handleTransferRecipientInput, handleTransferConfirmation } from "./bot/conversations/transfer";
import { handleMultichequeCurrencySelection, handleMultichequeAmountInput, handleMultichequeConfirmation } from "./bot/conversations/multicheque";
import { handleExternalWithdrawalFlow, handleWithdrawalCurrencySelection, handleWithdrawalAmountInput, handleWithdrawalNetworkSelection, handleWithdrawalAddressInput, handleWithdrawalConfirmation } from "./bot/conversations/external-withdrawal";
import { WebhookService } from "./services/webhook";
import { ErrorHandler, ErrorType } from "./bot/utils/error-handler";
import * as dotenv from 'dotenv';

dotenv.config();

const errorHandler = ErrorHandler.getInstance();

/**
 * Creates a new bot instance
 */
const bot = new Bot<BotContext>(process.env.BOT_TOKEN || "");

// Session middleware
bot.use(session({ initial: () => ({}) }));

// Register command handlers
bot.command("start", handleStart);

// Register callback handlers
bot.callbackQuery("deposit", handleDepositFlow);
bot.callbackQuery("balance", handleBalance);
bot.callbackQuery("my_invoices", handleInvoices);
bot.callbackQuery("main_menu", handleMainMenu);
bot.callbackQuery("withdraw", handleWithdraw);
bot.callbackQuery("my_withdrawals", handleMyWithdrawals);
bot.callbackQuery("withdraw_transfer", handleWithdrawTransfer);
bot.callbackQuery("withdraw_multicheque", handleWithdrawMulticheque);
bot.callbackQuery("withdraw_external", handleWithdrawExternal);
bot.callbackQuery(/^invoice_/, handleInvoiceDetail);
bot.callbackQuery(/^check_payment_/, handleCheckPayment);
bot.callbackQuery(/^delete_invoice_/, handleDeleteInvoice);
bot.callbackQuery(/^invoices_page_/, handleInvoicePagination);
bot.callbackQuery(/^open_cheque_/, handleOpenCheque);

// Register deposit flow handlers
bot.callbackQuery(/^coin_/, handleCurrencySelection);

// Register transfer flow handlers
bot.callbackQuery(/^transfer_coin_/, handleTransferCurrencySelection);
bot.callbackQuery("confirm_transfer", handleTransferConfirmation);

// Register multicheque flow handlers
bot.callbackQuery(/^multicheque_currency_/, handleMultichequeCurrencySelection);
bot.callbackQuery("confirm_multicheque", handleMultichequeConfirmation);

// Register external withdrawal flow handlers
bot.callbackQuery(/^withdrawal_currency_/, handleWithdrawalCurrencySelection);
bot.callbackQuery(/^withdrawal_network_/, handleWithdrawalNetworkSelection);
bot.callbackQuery("withdrawal_confirm", handleWithdrawalConfirmation);

// Register withdrawal detail handlers
bot.callbackQuery(/^withdrawal_/, handleWithdrawalDetail);
bot.callbackQuery(/^check_withdrawal_/, handleCheckWithdrawalStatus);

// Register history handlers
bot.callbackQuery("history_transfers", handleHistoryTransfers);
bot.callbackQuery("history_cheques", handleHistoryCheques);
bot.callbackQuery("history_withdrawals", handleHistoryWithdrawals);
bot.callbackQuery(/^transfers_page_/, handleTransferPagination);
bot.callbackQuery(/^cheques_page_/, handleChequePagination);
bot.callbackQuery(/^withdrawals_page_/, handleWithdrawalPagination);
bot.callbackQuery(/^cheque_/, handleChequeDetail);
bot.callbackQuery(/^transfer_detail_/, handleTransferDetail);

bot.on("message:text", async (ctx) => {
    // Handle amount input for deposit flow
    if (ctx.session.step === "deposit_amount") {
        await handleAmountInput(ctx);
    }
    // Handle amount input for transfer flow
    else if (ctx.session.step === "transfer_amount") {
        await handleTransferAmountInput(ctx);
    }
    // Handle recipient input for transfer flow
    else if (ctx.session.step === "transfer_recipient") {
        await handleTransferRecipientInput(ctx);
    }
    // Handle amount input for multicheque flow
    else if (ctx.session.step === "multicheque_amount") {
        await handleMultichequeAmountInput(ctx);
    }
    // Handle amount input for withdrawal flow
    else if (ctx.session.step === "withdrawal_amount") {
        await handleWithdrawalAmountInput(ctx);
    }
    // Handle address input for withdrawal flow
    else if (ctx.session.step === "withdrawal_address") {
        await handleWithdrawalAddressInput(ctx);
    }
});

// Error handler
bot.catch((err) => {
    errorHandler.logError(err, ErrorType.UNKNOWN_ERROR, {
        conversation: 'bot_main',
        action: 'bot_catch',
        data: { errorType: 'bot_error' }
    });
});

/**
 * Creates Express app for webhook handling
 */
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON bodies
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Webhook endpoint for xRocket Pay invoice events
 */
app.post(process.env.WEBHOOK_URL as string, (req: Request, res: Response) => {
    const signature = req.headers['rocket-pay-signature'] as string;
    const body = JSON.stringify(req.body);

    if (!signature) {
        errorHandler.logError(new Error('Missing rocket-pay-signature header'), ErrorType.VALIDATION_ERROR, {
            conversation: 'webhook_endpoint',
            action: 'webhook_validation',
            data: { headers: Object.keys(req.headers) }
        });
        res.status(400).json({ error: 'Missing signature header' });
        return;
    }

    const webhookService = WebhookService.getInstance(bot);
    webhookService.handleInvoiceWebhook(body, signature)
        .then(result => {
            if (result.success) {
                console.log('[Webhook] Successfully processed webhook:', result.message);
                res.status(200).json({ success: true, message: result.message });
            } else {
                errorHandler.logError(new Error(result.message), ErrorType.API_ERROR, {
                    conversation: 'webhook_endpoint',
                    action: 'webhook_processing_failed',
                    data: { result }
                });
                res.status(400).json({ success: false, message: result.message });
            }
        })
        .catch(error => {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'webhook_endpoint',
                action: 'webhook_processing',
                data: { body: body.substring(0, 100) + '...' }
            });
            res.status(500).json({ success: false, message: 'Internal server error' });
        });
});

/**
 * Initializes the database and starts both bot and webhook server
 */
async function bootstrap(): Promise<void> {
    try {
        await AppDataSource.initialize();
        console.log("Database connection established");
        
        // Start the webhook server
        app.listen(PORT, () => {
            console.log(`Webhook server started on port ${PORT}`);
        });
        
        // Start the bot
        await bot.start();
        console.log("Bot started");
        
        console.log("Application started successfully");
    } catch (error) {
        errorHandler.logError(error, ErrorType.DATABASE_ERROR, {
            conversation: 'bootstrap',
            action: 'application_startup',
            data: { port: PORT }
        });
        process.exit(1);
    }
}

bootstrap();
