import { XRocketPayClient } from 'xrocket-pay-api-sdk';
import { UserInvoice } from '../entities/user-invoice';
import { UserTransfer } from '../entities/user-transfer';
import { UserCheque } from '../entities/user-cheque';
import { UserWithdrawal } from '../entities/user-withdrawal';
import { AppDataSource } from '../config/database';
import { CurrencyConverter, InternalCurrency } from '../types/currency';
import { CreateChequeDto, SimpleChequeResponse, PaginatedShortChequeDtoResponse } from 'xrocket-pay-api-sdk/dist/types/multicheque';
import { CreateWithdrawalDto, AppWithdrawalResponse, WithdrawalFeesResponse, WithdrawalStatusResponse } from 'xrocket-pay-api-sdk/dist/types/app';
import { AvailableCoinsResponse } from 'xrocket-pay-api-sdk/dist/types/currencies';
import { ErrorHandler, ErrorType } from '../bot/utils/error-handler';

const errorHandler = ErrorHandler.getInstance();

export class XRocketPayService {
    private static instance: XRocketPayService;
    private client: XRocketPayClient;

    private constructor() {
        this.client = new XRocketPayClient({
            baseUrl: process.env.XROCKET_API_URL || 'https://pay.xrocket.tg',
            apiKey: process.env.XROCKET_API_KEY || '',
            timeout: 30000
        });
    }

    public static getInstance(): XRocketPayService {
        if (!XRocketPayService.instance) {
            XRocketPayService.instance = new XRocketPayService();
        }
        return XRocketPayService.instance;
    }

    /**
     * Creates a new payment invoice
     */
    public async createInvoice(userInvoice: UserInvoice): Promise<{ paymentUrl: string; invoiceId: string }> {
        try {
            // Convert internal currency to external currency for xRocket Pay API
            const externalCurrency = CurrencyConverter.toExternal(userInvoice.currency as InternalCurrency);
            
            // Create callback URL to redirect back to bot
            const callbackUrl = `https://t.me/${process.env.BOT_USERNAME || 'xrocketpay_example_bot'}?start=invoice_${userInvoice.id}`;
            
            const response = await this.client.createInvoice({
                amount: userInvoice.amount,
                currency: externalCurrency,
                description: `Deposit for user ${userInvoice.user.telegramId}`,
                numPayments: 1,
                expiredIn: 3600, // 1 hour expiration
                callbackUrl: callbackUrl
            });

            if (!response.success || !response.data) {
                throw new Error('Failed to create invoice');
            }

            // Update invoice with payment URL and invoice ID
            const invoiceRepo = AppDataSource.getRepository(UserInvoice);
            await invoiceRepo.update(userInvoice.id, {
                status: 'active',
                invoiceId: response.data.id.toString(),
                paymentUrl: response.data.link
            });

            return {
                paymentUrl: response.data.link,
                invoiceId: response.data.id.toString()
            };
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'create_invoice',
                data: { invoiceId: userInvoice.id, currency: userInvoice.currency }
            });
            throw error;
        }
    }

    /**
     * Checks invoice status and returns full invoice data
     */
    public async checkInvoiceStatus(invoiceId: string): Promise<{ status: string; data?: any }> {
        try {
            const response = await this.client.getInvoice(invoiceId);
            if (!response.success || !response.data) {
                throw new Error('Failed to get invoice status');
            }
            return {
                status: response.data.status,
                data: response.data
            };
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'check_invoice_status',
                data: { invoiceId }
            });
            throw error;
        }
    }

    /**
     * Deletes an invoice
     */
    public async deleteInvoice(invoiceId: string): Promise<boolean> {
        try {
            const response = await this.client.deleteInvoice(invoiceId);
            
            if (!response.success) {
                throw new Error('Failed to delete invoice');
            }

            return true;
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'delete_invoice',
                data: { invoiceId }
            });
            throw error;
        }
    }

    /**
     * Creates a transfer between users
     */
    public async createTransfer(userTransfer: UserTransfer): Promise<{ transferId: string }> {
        try {
            // Validate input
            if (!userTransfer.amount || userTransfer.amount <= 0) {
                throw new Error('Invalid transfer amount');
            }

            if (!userTransfer.recipientTelegramId || userTransfer.recipientTelegramId <= 0) {
                throw new Error('Invalid recipient Telegram ID');
            }

            if (!userTransfer.currency) {
                throw new Error('Invalid currency');
            }

            // Convert internal currency to external currency for xRocket Pay API
            const externalCurrency = CurrencyConverter.toExternal(userTransfer.currency as InternalCurrency);
            
            const response = await this.client.createTransfer({
                amount: userTransfer.amount,
                currency: externalCurrency,
                tgUserId: userTransfer.recipientTelegramId,
                transferId: userTransfer.id.toString(),
                description: `Transfer from ${userTransfer.sender.username || userTransfer.sender.telegramId}`
            });

            if (!response.success || !response.data) {
                throw new Error('Failed to create transfer');
            }

            // Update transfer with transfer ID
            const transferRepo = AppDataSource.getRepository(UserTransfer);
            await transferRepo.update(userTransfer.id, {
                transferId: response.data.id.toString()
            });

            return {
                transferId: response.data.id.toString()
            };
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'create_transfer',
                data: { transferId: userTransfer.id, currency: userTransfer.currency }
            });
            throw error;
        }
    }

    /**
     * Creates a multicheque
     */
    public async createMulticheque(userCheque: UserCheque): Promise<{ chequeId: number; link: string }> {
        try {
            // Validate input
            if (!userCheque.amount || userCheque.amount <= 0) {
                throw new Error('Invalid cheque amount');
            }

            if (!userCheque.currency) {
                throw new Error('Invalid currency');
            }

            if (!userCheque.usersNumber || userCheque.usersNumber <= 0) {
                throw new Error('Invalid users number');
            }

            // Convert internal currency to external currency for xRocket Pay API
            const externalCurrency = CurrencyConverter.toExternal(userCheque.currency as InternalCurrency);
            
            const chequeData: CreateChequeDto = {
                currency: externalCurrency,
                chequePerUser: userCheque.amount,
                usersNumber: userCheque.usersNumber,
                refProgram: 0, // No referral program for now
                description: `Cheque from ${userCheque.user.username || userCheque.user.telegramId}`,
                sendNotifications: true,
                enableCaptcha: true
            };

            const response = await this.client.createMulticheque(chequeData);

            if (!response.success || !response.data) {
                throw new Error('Failed to create multicheque');
            }

            // Update cheque with cheque ID and link
            const chequeRepo = AppDataSource.getRepository(UserCheque);
            await chequeRepo.update(userCheque.id, {
                chequeId: response.data.id,
                link: response.data.link,
                status: response.data.state
            });

            return {
                chequeId: response.data.id,
                link: response.data.link
            };
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'create_multicheque',
                data: { chequeId: userCheque.id, currency: userCheque.currency }
            });
            throw error;
        }
    }

    /**
     * Gets a specific multicheque by ID
     */
    public async getMulticheque(chequeId: number): Promise<SimpleChequeResponse> {
        try {
            const response = await this.client.getMulticheque(chequeId);
            
            if (!response.success) {
                throw new Error('Failed to get multicheque');
            }

            return response;
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'get_multicheque',
                data: { chequeId }
            });
            throw error;
        }
    }

    /**
     * Gets list of multicheques with pagination
     */
    public async getMulticheques(params?: { page?: number; limit?: number }): Promise<PaginatedShortChequeDtoResponse> {
        try {
            const response = await this.client.getMulticheques(params);
            
            if (!response.success) {
                throw new Error('Failed to get multicheques');
            }

            return response;
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'get_multicheques',
                data: { params }
            });
            throw error;
        }
    }

    /**
     * Validates if a Telegram ID exists and is valid
     */
    public async validateTelegramId(telegramId: number): Promise<boolean> {
        try {
            // This is a placeholder - in a real implementation, you might want to
            // check if the user exists in your database or validate through Telegram API
            if (!telegramId || telegramId <= 0) {
                return false;
            }

            // Telegram IDs can be 1-15 digits
            const telegramIdStr = telegramId.toString();
            if (telegramIdStr.length < 1 || telegramIdStr.length > 15) {
                return false;
            }

            return true;
        } catch (error) {
            errorHandler.logError(error, ErrorType.VALIDATION_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'validate_telegram_id',
                data: { telegramId }
            });
            return false;
        }
    }

    /**
     * Creates a withdrawal to an external wallet
     */
    public async createWithdrawal(userWithdrawal: UserWithdrawal): Promise<{ withdrawalId: string }> {
        try {
            // Validate input
            if (!userWithdrawal.amount || userWithdrawal.amount <= 0) {
                throw new Error('Invalid withdrawal amount');
            }
            if (!userWithdrawal.currency) {
                throw new Error('Invalid currency');
            }
            if (!userWithdrawal.address) {
                throw new Error('Invalid withdrawal address');
            }
            if (!userWithdrawal.network) {
                throw new Error('Invalid withdrawal network');
            }

            // Convert internal currency to external currency for xRocket Pay API
            const externalCurrency = CurrencyConverter.toExternal(userWithdrawal.currency as InternalCurrency);

            const withdrawalDto: CreateWithdrawalDto = {
                amount: userWithdrawal.amount,
                currency: externalCurrency,
                withdrawalId: userWithdrawal.id.toString(),
                network: userWithdrawal.network,
                address: userWithdrawal.address,
                comment: userWithdrawal.comment || undefined
            };

            const response: AppWithdrawalResponse = await this.client.createWithdrawal(withdrawalDto);

            if (!response.success || !response.data) {
                throw new Error('Failed to create withdrawal');
            }

            // Update withdrawal with withdrawal ID and status
            const withdrawalRepo = AppDataSource.getRepository(UserWithdrawal);
            await withdrawalRepo.update(userWithdrawal.id, {
                withdrawalId: response.data.withdrawalId,
                status: response.data.status,
                txHash: response.data.txHash || null,
                txLink: response.data.txLink || null,
                error: response.data.error || null
            });

            return {
                withdrawalId: response.data.withdrawalId
            };
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'create_withdrawal',
                data: { withdrawalId: userWithdrawal.id, currency: userWithdrawal.currency, network: userWithdrawal.network }
            });
            throw error;
        }
    }

    /**
     * Gets all available currencies information
     */
    public async getAvailableCurrencies(): Promise<AvailableCoinsResponse> {
        try {
            const response: AvailableCoinsResponse = await this.client.getAvailableCurrencies();
            if (!response.success || !response.data) {
                throw new Error('Failed to get available currencies');
            }
            return response;
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'get_available_currencies'
            });
            throw error;
        }
    }

    /**
     * Gets available networks for a specific currency
     */
    public async getAvailableNetworks(currency: string): Promise<string[]> {
        try {
            // Convert internal currency to external currency for xRocket Pay API
            const externalCurrency = CurrencyConverter.toExternal(currency as InternalCurrency);
            
            const response: AvailableCoinsResponse = await this.client.getAvailableCurrencies();
            if (!response.success || !response.data) {
                throw new Error('Failed to get available networks');
            }

            // Find the currency data and extract available networks
            const currencyData = response.data.results.find(c => c.currency === externalCurrency);
            if (!currencyData || !currencyData.feeWithdraw || !currencyData.feeWithdraw.networks) {
                return [];
            }

            // Extract network codes from the networks
            return currencyData.feeWithdraw.networks.map(network => network.networkCode);
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'get_available_networks',
                data: { currency }
            });
            throw error;
        }
    }

    /**
     * Gets withdrawal fees for a given currency and amount
     */
    public async getWithdrawalFees(currency: string, amount: number): Promise<WithdrawalFeesResponse> {
        try {
            // Convert internal currency to external currency for xRocket Pay API
            const externalCurrency = CurrencyConverter.toExternal(currency as InternalCurrency);
            
            const response: WithdrawalFeesResponse = await this.client.getWithdrawalFees(externalCurrency);
            if (!response.success || !response.data) {
                throw new Error('Failed to get withdrawal fees');
            }
            return response;
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'get_withdrawal_fees',
                data: { currency, amount }
            });
            throw error;
        }
    }

    /**
     * Gets withdrawal status
     */
    public async getWithdrawalStatus(withdrawalId: string): Promise<WithdrawalStatusResponse> {
        try {
            const response: WithdrawalStatusResponse = await this.client.getWithdrawalStatus(withdrawalId);
            if (!response.success || !response.data) {
                throw new Error('Failed to get withdrawal status');
            }
            return response;
        } catch (error) {
            errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'xrocket_pay_service',
                action: 'get_withdrawal_status',
                data: { withdrawalId }
            });
            throw error;
        }
    }
} 