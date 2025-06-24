import { BotContext } from "../../types/bot";
import { InlineKeyboard } from "grammy";
import { createMainMenuKeyboard } from "../keyboards/main";
import { UserService } from "../../services/user";
import { XRocketPayService } from "../../services/xrocket-pay";
import { CurrencyConverter, InternalCurrency } from "../../types/currency";
import { formatNumber } from "../utils/formatters";
import { AppDataSource } from "../../config/database";
import { UserWithdrawal, WithdrawalNetwork } from "../../entities/user-withdrawal";
import logger from "../../utils/logger";
import { createWithdrawalDetailKeyboard } from "../keyboards/withdrawal";
import { TransactionService } from "../../services/transaction";

function createWithdrawalCurrencyKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const codes = CurrencyConverter.getSupportedInternalCodes();
    codes.forEach((code, idx) => {
        const config = CurrencyConverter.getConfig(code);
        keyboard.text(`${config.emoji} ${config.name}`, `withdrawal_currency_${code}`);
        if ((idx + 1) % 2 === 0 && idx !== codes.length - 1) {
            keyboard.row();
        }
    });
    return keyboard;
}

function createWithdrawalNetworkKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text('TON', 'withdrawal_network_TON')
        .text('BSC', 'withdrawal_network_BSC')
        .row()
        .text('ETH', 'withdrawal_network_ETH')
        .text('BTC', 'withdrawal_network_BTC')
        .row()
        .text('TRX', 'withdrawal_network_TRX')
        .text('SOL', 'withdrawal_network_SOL');
}

export async function handleExternalWithdrawalFlow(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Starting external withdrawal flow');
    if (!ctx.chat || !ctx.callbackQuery) throw new Error("Invalid context for withdrawal flow");
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);
    ctx.session.step = "withdrawal_currency";
    ctx.session.selectedCoin = undefined;
    ctx.session.withdrawalAmount = undefined;
    ctx.session.withdrawalNetwork = undefined;
    ctx.session.withdrawalAddress = undefined;
    ctx.session.withdrawalFee = undefined;
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        "💸 Choose currency to withdraw:",
        { reply_markup: createWithdrawalCurrencyKeyboard() }
    );
}

export async function handleWithdrawalCurrencySelection(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Currency selection received');
    if (!ctx.chat || !ctx.callbackQuery) throw new Error("Invalid context for currency selection");
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);
    const match = ctx.callbackQuery.data?.match(/withdrawal_currency_(.+)/);
    if (!match) return;
    const selectedCoin = match[1] as InternalCurrency;
    if (!CurrencyConverter.isSupportedInternal(selectedCoin)) {
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            "❌ Invalid currency selected. Please try again.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }
    ctx.session.selectedCoin = selectedCoin;
    ctx.session.step = "withdrawal_network";
    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        `🌐 Choose network for ${currencyConfig.emoji} ${currencyConfig.name}:`,
        { reply_markup: createWithdrawalNetworkKeyboard() }
    );
}

export async function handleWithdrawalNetworkSelection(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Network selection received');
    if (!ctx.chat || !ctx.callbackQuery) throw new Error("Invalid context for network selection");
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);
    const match = ctx.callbackQuery.data?.match(/withdrawal_network_(.+)/);
    if (!match) return;
    const network = match[1] as WithdrawalNetwork;
    ctx.session.withdrawalNetwork = network;
    
    // Get user balance and withdrawal fee
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    const selectedCoin = ctx.session.selectedCoin;
    if (!selectedCoin) {
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            "❌ No currency selected. Please start over.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }
    
    const balance = await userService.getUserBalance(user, selectedCoin);
    const currentBalance = balance ? balance.amount : 0;
    
    // Get withdrawal fee for this currency and network
    const xrocketPay = XRocketPayService.getInstance();
    let fee = 0;
    try {
        const feeResponse = await xrocketPay.getWithdrawalFees(selectedCoin, 1); // Use 1 as base amount for fee calculation
        if (feeResponse.data && feeResponse.data.length > 0) {
            // Find the fee for the selected network
            const currencyData = feeResponse.data.find(c => c.code === selectedCoin);
            if (currencyData) {
                const networkFee = currencyData.fees.find(f => f.networkCode === network);
                if (networkFee) {
                    fee = networkFee.feeWithdraw.fee;
                }
            }
        }
    } catch (error) {
        logger.error('[Withdrawal] Error getting withdrawal fee:', error);
    }
    
    ctx.session.withdrawalFee = fee;
    ctx.session.step = "withdrawal_amount";
    
    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    const maxWithdrawal = Math.max(0, currentBalance - fee);
    
    await ctx.api.editMessageText(
        ctx.chat.id,
        ctx.callbackQuery.message!.message_id,
        `💰 Your ${currencyConfig.emoji} ${currencyConfig.name} balance: ${formatNumber(currentBalance)}\n` +
        `💸 Withdrawal fee (${network}): ${formatNumber(fee)} ${currencyConfig.name}\n` +
        `📊 Maximum withdrawal: ${formatNumber(maxWithdrawal)} ${currencyConfig.name}\n\n` +
        `💵 Enter amount to withdraw:`,
        { reply_markup: new InlineKeyboard() }
    );
}

export async function handleWithdrawalAmountInput(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Amount input received');
    if (!ctx.chat || !ctx.message?.text) throw new Error("Invalid context for amount input");
    const amount = parseFloat(ctx.message.text);
    if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ Invalid amount. Please try again.", { reply_markup: createMainMenuKeyboard() });
        return;
    }
    const selectedCoin = ctx.session.selectedCoin;
    const fee = ctx.session.withdrawalFee ?? 0;
    if (!selectedCoin) {
        await ctx.reply("❌ No currency selected. Please start over.", { reply_markup: createMainMenuKeyboard() });
        return;
    }
    // Check user balance (including fee)
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    const balance = await userService.getUserBalance(user, selectedCoin);
    const totalRequired = amount + fee;
    if (!balance || balance.amount < totalRequired) {
        const availableAmount = balance ? balance.amount : 0;
        await ctx.reply(
            `❌ Insufficient balance. You need ${formatNumber(totalRequired)} ${selectedCoin} (${formatNumber(amount)} + ${formatNumber(fee)} fee), but have ${formatNumber(availableAmount)} ${selectedCoin}.`,
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }
    ctx.session.withdrawalAmount = amount;
    ctx.session.step = "withdrawal_address";
    const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
    const network = ctx.session.withdrawalNetwork;
    await ctx.reply(
        `💸 Withdrawal amount: ${formatNumber(amount)} ${currencyConfig.name}\n` +
        `💸 Fee: ${formatNumber(fee)} ${currencyConfig.name}\n` +
        `💰 Total amount: ${formatNumber(totalRequired)} ${currencyConfig.name}\n\n` +
        `🔗 Enter the external wallet address for ${network}:`,
        { reply_markup: new InlineKeyboard() }
    );
}

export async function handleWithdrawalAddressInput(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Address input received');
    if (!ctx.chat || !ctx.message?.text) throw new Error("Invalid context for address input");
    const address = ctx.message.text.trim();
    if (!address || address.length < 5) {
        await ctx.reply("❌ Invalid address. Please try again.", { reply_markup: createMainMenuKeyboard() });
        return;
    }
    ctx.session.withdrawalAddress = address;
    ctx.session.step = "withdrawal_confirm";
    // Show confirmation
    const selectedCoin = ctx.session.selectedCoin;
    const amount = ctx.session.withdrawalAmount ?? 0;
    const fee = ctx.session.withdrawalFee ?? 0;
    const network = ctx.session.withdrawalNetwork as WithdrawalNetwork;
    const totalAmount = amount + fee;
    await ctx.reply(
        `⚠️ Please confirm your withdrawal:\n\n` +
        `💰 Amount: ${formatNumber(amount)} ${selectedCoin}\n` +
        `💸 Fee: ${formatNumber(fee)} ${selectedCoin}\n` +
        `💰 Total: ${formatNumber(totalAmount)} ${selectedCoin}\n` +
        `🌐 Network: ${network}\n` +
        `🔗 Address: ${address}\n\n` +
        `Do you want to proceed?`,
        {
            reply_markup: new InlineKeyboard()
                .text('✅ Confirm', 'withdrawal_confirm')
                .row()
                .text('❌ Cancel', 'main_menu')
        }
    );
}

export async function handleWithdrawalConfirmation(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Confirmation received');
    if (!ctx.chat || !ctx.callbackQuery) throw new Error("Invalid context for withdrawal confirmation");
    await ctx.api.answerCallbackQuery(ctx.callbackQuery.id);
    const selectedCoin = ctx.session.selectedCoin;
    const amount = ctx.session.withdrawalAmount ?? 0;
    const fee = ctx.session.withdrawalFee ?? 0;
    const network = ctx.session.withdrawalNetwork as WithdrawalNetwork;
    const address = ctx.session.withdrawalAddress;
    if (!selectedCoin || !amount || !network || !address) {
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            "❌ Session data missing. Please start over.",
            { reply_markup: createMainMenuKeyboard() }
        );
        return;
    }
    // Get user
    const userService = UserService.getInstance();
    const user = await userService.findOrCreateUser(ctx);
    // Create withdrawal record
    const withdrawalRepo = AppDataSource.getRepository(UserWithdrawal);
    const withdrawal = UserWithdrawal.create(
        user,
        amount,
        selectedCoin,
        fee,
        network,
        address
    );
    const savedWithdrawal = await withdrawalRepo.save(withdrawal);
    // Execute withdrawal via TransactionService (ensures transaction safety)
    const transactionService = TransactionService.getInstance();
    try {
        const result = await transactionService.processWithdrawal(savedWithdrawal);
        
        // Show withdrawal details page
        logger.info('[Withdrawal] Showing withdrawal details');
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        const statusEmoji = getWithdrawalStatusEmoji(savedWithdrawal.status);
        
        const detailMessage = `Withdrawal Details\n\n` +
            `💰 Amount: ${formatNumber(amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
            `💸 Fee: ${formatNumber(fee)} ${currencyConfig.name}\n` +
            `💰 Total: ${formatNumber(amount + fee)} ${currencyConfig.name}\n` +
            `🌐 Network: ${network}\n` +
            `🔗 Address: ${address}\n` +
            `📊 Status: ${statusEmoji} ${savedWithdrawal.status}\n` +
            `🆔 Withdrawal ID: ${result.withdrawalId}\n` +
            `📅 Created: ${savedWithdrawal.createdAt.toLocaleDateString()}`;

        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            detailMessage,
            { reply_markup: createWithdrawalDetailKeyboard(savedWithdrawal) }
        );

        logger.info('[Withdrawal] Withdrawal flow completed successfully');

    } catch (error) {
        logger.error('[Withdrawal] Error creating withdrawal:', error);
        await ctx.api.editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message!.message_id,
            `❌ Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { reply_markup: createMainMenuKeyboard() }
        );
    }
    // Clear session
    ctx.session.step = undefined;
    ctx.session.selectedCoin = undefined;
    ctx.session.withdrawalAmount = undefined;
    ctx.session.withdrawalNetwork = undefined;
    ctx.session.withdrawalAddress = undefined;
    ctx.session.withdrawalFee = undefined;
}

/**
 * Get status emoji for withdrawal status
 */
function getWithdrawalStatusEmoji(status: string): string {
    switch (status) {
        case 'CREATED': return '⏳';
        case 'COMPLETED': return '✅';
        case 'FAIL': return '❌';
        default: return '❓';
    }
} 