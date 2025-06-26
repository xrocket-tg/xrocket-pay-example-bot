import { BotContext } from "../../types/bot";
import { InlineKeyboard } from "grammy";
import { createMainMenuKeyboard } from "../keyboards/main";
import { UserService } from "../../services/user";
import { XRocketPayService } from "../../services/xrocket-pay";
import { CurrencyConverter, InternalCurrency, WithdrawalNetwork } from "../../types/currency";
import { formatCurrency, formatDate } from "../utils/formatters";
import { AppDataSource } from "../../config/database";
import { UserWithdrawal } from "../../entities/user-withdrawal";
import logger from "../../utils/logger";
import { createWithdrawalDetailKeyboard } from "../keyboards/withdrawal";
import { TransactionService } from "../../services/transaction";
import { ValidationService } from "../utils/validation";
import { ErrorHandler, ErrorType } from "../utils/error-handler";
import { MessageService } from "../services/message-service";

const errorHandler = ErrorHandler.getInstance();

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

async function createWithdrawalNetworkKeyboard(currency: InternalCurrency): Promise<InlineKeyboard> {
    const keyboard = new InlineKeyboard();
    
    try {
        const xrocketPay = XRocketPayService.getInstance();
        const availableNetworks = await xrocketPay.getAvailableNetworks(currency);
        
        availableNetworks.forEach((network, idx) => {
            keyboard.text(network, `withdrawal_network_${network}`);
            if ((idx + 1) % 2 === 0 && idx !== availableNetworks.length - 1) {
                keyboard.row();
            }
        });
    } catch (error) {
        errorHandler.logError(error, ErrorType.API_ERROR, {
            conversation: 'external_withdrawal',
            action: 'get_available_networks',
            data: { currency }
        });
        // Fallback to empty keyboard if API call fails
    }
    
    return keyboard;
}

export async function handleExternalWithdrawalFlow(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Starting external withdrawal flow');
    
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for withdrawal flow");
        }
        
        await errorHandler.safeAnswerCallbackQuery(ctx);
        ctx.session.step = "withdrawal_currency";
        ctx.session.selectedCoin = undefined;
        ctx.session.withdrawalAmount = undefined;
        ctx.session.withdrawalNetwork = undefined;
        ctx.session.withdrawalAddress = undefined;
        ctx.session.withdrawalFee = undefined;
        await messageService.editMessage(
            ctx,
            "💸 Choose currency to withdraw:",
            createWithdrawalCurrencyKeyboard()
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'external_withdrawal', 'flow_start');
    }
}

export async function handleWithdrawalCurrencySelection(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Currency selection received');
    
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for currency selection");
        }
        
        // Use safe callback query answering
        await errorHandler.safeAnswerCallbackQuery(ctx);
        
        const match = ctx.callbackQuery!.data?.match(/withdrawal_currency_(.+)/);
        if (!match) {
            throw new Error("Invalid callback data format");
        }
        
        const selectedCoin = validationService.validateCurrency(match[1], "");
        if (!selectedCoin) {
            throw new Error("Invalid currency selected");
        }
        
        ctx.session.selectedCoin = selectedCoin;
        ctx.session.step = "withdrawal_network";
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        
        const networkKeyboard = await createWithdrawalNetworkKeyboard(selectedCoin);
        await messageService.editMessage(
            ctx,
            `🌐 Choose network for ${currencyConfig.emoji} ${currencyConfig.name}:`,
            networkKeyboard
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'external_withdrawal', 'currency_selection');
    }
}

export async function handleWithdrawalNetworkSelection(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Network selection received');
    
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for network selection");
        }
        
        // Use safe callback query answering
        await errorHandler.safeAnswerCallbackQuery(ctx);
        
        const match = ctx.callbackQuery!.data?.match(/withdrawal_network_(.+)/);
        if (!match) {
            throw new Error("Invalid callback data format");
        }
        
        const network = match[1] as WithdrawalNetwork;
        ctx.session.withdrawalNetwork = network;
        
        // Get user balance and withdrawal fee
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        
        if (!validationService.validateSession(ctx, ['selectedCoin'])) {
            throw new Error("No currency selected. Please start over.");
        }
        
        const selectedCoin = ctx.session.selectedCoin!;
        const balance = await userService.getUserBalance(user, selectedCoin);
        const currentBalance = balance ? balance.amount : 0;
        
        // Get withdrawal fee for this currency and network
        const xrocketPay = XRocketPayService.getInstance();
        let fee = 0;
        try {
            const feeResponse = await xrocketPay.getWithdrawalFees(selectedCoin, 1); // Use 1 as base amount for fee calculation
            if (feeResponse.data && feeResponse.data.length > 0) {
                // Find the fee for the selected network
                // Use external currency code since xRocket Pay returns fees with external codes
                const externalCurrency = CurrencyConverter.toExternal(selectedCoin);
                const currencyData = feeResponse.data.find(c => c.code === externalCurrency);
                if (currencyData) {
                    const networkFee = currencyData.fees.find(f => f.networkCode === network);
                    if (networkFee) {
                        fee = networkFee.feeWithdraw.fee;
                    }
                }
            }
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'external_withdrawal',
                action: 'get_withdrawal_fee',
                data: { currency: selectedCoin, network }
            });
        }
        
        ctx.session.withdrawalFee = fee;
        ctx.session.step = "withdrawal_amount";
        
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        const maxWithdrawal = Math.max(0, currentBalance - fee);
        
        await messageService.editMessage(
            ctx,
            `💰 Your ${currencyConfig.emoji} ${currencyConfig.name} balance: ${formatCurrency(currentBalance)}\n` +
            `💸 Withdrawal fee (${network}): ${formatCurrency(fee)} ${currencyConfig.name}\n` +
            `📊 Maximum withdrawal: ${formatCurrency(maxWithdrawal)} ${currencyConfig.name}\n\n` +
            `💵 Enter amount to withdraw:`,
            new InlineKeyboard()
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'external_withdrawal', 'network_selection');
    }
}

export async function handleWithdrawalAmountInput(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Amount input received');
    
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateMessageContext(ctx)) {
            throw new Error("Invalid context for amount input");
        }
        
        const amount = validationService.validateAmount(ctx.message!.text!);
        if (!amount) {
            throw new Error("Invalid amount. Please try again.");
        }
        
        if (!validationService.validateSession(ctx, ['selectedCoin', 'withdrawalFee'])) {
            throw new Error("No currency selected. Please start over.");
        }
        
        const selectedCoin = ctx.session.selectedCoin!;
        const fee = ctx.session.withdrawalFee ?? 0;
        
        // Check user balance (including fee)
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        
        const withdrawalValidation = await validationService.validateWithdrawalAmount(user, selectedCoin, amount, fee);
        if (!withdrawalValidation.isValid) {
            throw new Error(withdrawalValidation.errorMessage!);
        }
        
        ctx.session.withdrawalAmount = amount;
        ctx.session.step = "withdrawal_address";
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        const network = ctx.session.withdrawalNetwork;
        await messageService.editMessage(
            ctx,
            `💸 Withdrawal amount: ${formatCurrency(amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
            `💸 Fee: ${formatCurrency(fee)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
            `💰 Total amount: ${formatCurrency(withdrawalValidation.totalRequired)} ${currencyConfig.emoji} ${currencyConfig.name}\n\n` +
            `🔗 Enter the external wallet address for ${network}:`,
            new InlineKeyboard()
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'external_withdrawal', 'amount_input');
    }
}

export async function handleWithdrawalAddressInput(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Address input received');
    
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateMessageContext(ctx)) {
            throw new Error("Invalid context for address input");
        }
        
        const address = ctx.message!.text!.trim();
        if (!validationService.validateWalletAddress(address)) {
            throw new Error("Invalid address format. Please check the address and try again.");
        }
        
        ctx.session.withdrawalAddress = address;
        ctx.session.step = "withdrawal_confirm";
        
        // Show confirmation
        if (!validationService.validateSession(ctx, ['selectedCoin', 'withdrawalAmount', 'withdrawalFee', 'withdrawalNetwork'])) {
            throw new Error("Session data missing. Please start over.");
        }
        
        const selectedCoin = ctx.session.selectedCoin!;
        const amount = ctx.session.withdrawalAmount!;
        const fee = ctx.session.withdrawalFee!;
        const network = ctx.session.withdrawalNetwork as WithdrawalNetwork;
        const totalAmount = amount + fee;
        
        await messageService.editMessage(
            ctx,
            `⚠️ Please confirm your withdrawal:\n\n` +
            `💰 Amount: ${formatCurrency(amount)} ${selectedCoin}\n` +
            `💸 Fee: ${formatCurrency(fee)} ${selectedCoin}\n` +
            `💰 Total: ${formatCurrency(totalAmount)} ${selectedCoin}\n` +
            `🌐 Network: ${network}\n` +
            `🔗 Address: ${address}\n\n` +
            `Do you want to proceed?`,
            new InlineKeyboard()
                .text('✅ Confirm', 'withdrawal_confirm')
                .row()
                .text('❌ Cancel', 'main_menu')
        );
    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'external_withdrawal', 'address_input');
    }
}

export async function handleWithdrawalConfirmation(ctx: BotContext): Promise<void> {
    logger.info('[Withdrawal] Confirmation received');
    
    const validationService = ValidationService.getInstance();
    const messageService = MessageService.getInstance();
    
    try {
        if (!validationService.validateCallbackContext(ctx)) {
            throw new Error("Invalid context for withdrawal confirmation");
        }
        
        // Use safe callback query answering with a small delay to prevent timeout
        await new Promise(resolve => setTimeout(resolve, 100));
        await errorHandler.safeAnswerCallbackQuery(ctx);
        
        if (!validationService.validateSession(ctx, ['selectedCoin', 'withdrawalAmount', 'withdrawalNetwork', 'withdrawalAddress'])) {
            throw new Error("Session data missing. Please start over.");
        }
        
        const selectedCoin = ctx.session.selectedCoin!;
        const amount = ctx.session.withdrawalAmount!;
        const fee = ctx.session.withdrawalFee!;
        const network = ctx.session.withdrawalNetwork as WithdrawalNetwork;
        const address = ctx.session.withdrawalAddress!;
        
        // Get user
        const userService = UserService.getInstance();
        const user = await userService.findOrCreateUser(ctx);
        
        // Execute withdrawal via TransactionService (ensures transaction safety)
        const transactionService = TransactionService.getInstance();
        const savedWithdrawal = await transactionService.executeWithdrawal(
            user,
            amount,
            selectedCoin,
            fee,
            network,
            address
        );
        
        // Show withdrawal details page
        logger.info('[Withdrawal] Showing withdrawal details');
        const currencyConfig = CurrencyConverter.getConfig(selectedCoin);
        const statusEmoji = getWithdrawalStatusEmoji(savedWithdrawal.status);
        
        const detailMessage = `🌐 Withdrawal Details\n\n` +
            `💰 Amount: ${formatCurrency(amount)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
            `💸 Fee: ${formatCurrency(fee)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
            `💰 Total: ${formatCurrency(amount + fee)} ${currencyConfig.emoji} ${currencyConfig.name}\n` +
            `🌐 Network: ${network}\n` +
            `🔗 Address: ${address}\n` +
            `📊 Status: ${statusEmoji} ${savedWithdrawal.status}\n` +
            `🆔 Withdrawal ID: ${savedWithdrawal.withdrawalId || 'Processing...'}\n` +
            `📅 Created: ${formatDate(savedWithdrawal.createdAt)}`;

        await messageService.editMessage(
            ctx,
            detailMessage,
            createWithdrawalDetailKeyboard(savedWithdrawal)
        );

        logger.info('[Withdrawal] Withdrawal flow completed successfully');

        // Clear session only on success
        ctx.session.step = undefined;
        ctx.session.selectedCoin = undefined;
        ctx.session.withdrawalAmount = undefined;
        ctx.session.withdrawalNetwork = undefined;
        ctx.session.withdrawalAddress = undefined;
        ctx.session.withdrawalFee = undefined;

    } catch (error) {
        await errorHandler.handleConversationFlowError(ctx, error, 'external_withdrawal', 'confirmation');
    }
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