import { Bot, session } from "grammy";
import { BotContext } from "../types/bot";
import { AppDataSource } from "../config/database";
import { handleStart } from "./handlers/commands";
import { handleBalance, handleCheckPayment, handleInvoices, handleInvoiceDetail, handleInvoicePagination, handleDeleteInvoice, handleMainMenu, handleWithdraw, handleMyWithdrawals, handleWithdrawTransfer, handleWithdrawMulticheque, handleWithdrawExternal, handleOpenCheque, handleWithdrawalDetail, handleCheckWithdrawalStatus, handleHistoryTransfers, handleHistoryCheques, handleHistoryWithdrawals, handleTransferPagination, handleChequePagination, handleWithdrawalPagination, handleChequeDetail, handleTransferDetail } from "./handlers/callbacks";
import { handleDepositFlow, handleCurrencySelection, handleAmountInput } from "./conversations/deposit";
import { handleTransferFlow, handleTransferCurrencySelection, handleTransferAmountInput, handleTransferRecipientInput, handleTransferConfirmation } from "./conversations/transfer";
import { handleMultichequeCurrencySelection, handleMultichequeAmountInput, handleMultichequeConfirmation } from "./conversations/multicheque";
import { handleExternalWithdrawalFlow, handleWithdrawalCurrencySelection, handleWithdrawalAmountInput, handleWithdrawalNetworkSelection, handleWithdrawalAddressInput, handleWithdrawalConfirmation } from "./conversations/external-withdrawal";
import * as dotenv from 'dotenv';

dotenv.config();

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
    console.error("Bot error:", err);
});

/**
 * Initializes the database and starts the bot
 */
async function bootstrap(): Promise<void> {
    try {
        await AppDataSource.initialize();
        console.log("Database connection established");
        
        await bot.start();
        console.log("Bot started");
    } catch (error) {
        console.error("Error during startup:", error);
        process.exit(1);
    }
}

bootstrap(); 