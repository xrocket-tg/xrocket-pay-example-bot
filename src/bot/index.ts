import { Bot, session } from "grammy";
import { BotContext } from "../types/bot";
import { AppDataSource } from "../config/database";
import { handleStart } from "./handlers/commands";
import { handleDeposit, handleBalance, handleCheckPayment, handleInvoices, handleInvoiceDetail, handleInvoicePagination, handleDeleteInvoice, handleMainMenu, handleWithdraw, handleMyWithdrawals } from "./handlers/callbacks";
import { handleCurrencySelection, handleAmountInput } from "./conversations/deposit";
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
bot.callbackQuery("deposit", handleDeposit);
bot.callbackQuery("balance", handleBalance);
bot.callbackQuery("my_invoices", handleInvoices);
bot.callbackQuery("main_menu", handleMainMenu);
bot.callbackQuery("withdraw", handleWithdraw);
bot.callbackQuery("my_withdrawals", handleMyWithdrawals);
bot.callbackQuery(/^invoice_/, handleInvoiceDetail);
bot.callbackQuery(/^check_payment_/, handleCheckPayment);
bot.callbackQuery(/^delete_invoice_/, handleDeleteInvoice);
bot.callbackQuery(/^invoices_page_/, handleInvoicePagination);

// Register deposit flow handlers
bot.callbackQuery(/^coin_/, handleCurrencySelection);
bot.on("message:text", async (ctx) => {
    // Handle amount input for deposit flow
    if (ctx.session.step === "deposit_amount") {
        await handleAmountInput(ctx);
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