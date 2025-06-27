import { AppDataSource } from "../config/database";
import { UserInvoice } from "../entities/user-invoice";
import { UserTransfer } from "../entities/user-transfer";
import { UserWithdrawal } from "../entities/user-withdrawal";
import { UserBalance } from "../entities/user-balance";
import { UserService } from "./user";
import { XRocketPayService } from "./xrocket-pay";
import { InternalCurrency, WithdrawalNetwork } from "../types/currency";
import logger from "../utils/logger";
import { ErrorHandler, ErrorType } from "../bot/utils/error-handler";

/**
 * Transaction Service for handling all database transactions
 * Ensures data consistency across multiple operations
 */
export class TransactionService {
    private static instance: TransactionService;
    private userService: UserService;
    private xrocketPayService: XRocketPayService;
    private errorHandler: ErrorHandler;

    private constructor() {
        this.userService = UserService.getInstance();
        this.xrocketPayService = XRocketPayService.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
    }

    public static getInstance(): TransactionService {
        if (!TransactionService.instance) {
            TransactionService.instance = new TransactionService();
        }
        return TransactionService.instance;
    }

    /**
     * Processes invoice payment with transaction safety
     */
    public async processInvoicePayment(invoice: UserInvoice, amountToAdd?: number): Promise<void> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            logger.info('[TransactionService] Processing invoice payment:', {
                invoiceId: invoice.id,
                amount: invoice.amount,
                currency: invoice.currency,
                amountToAdd: amountToAdd
            });

            // Update invoice status
            const invoiceRepo = queryRunner.manager.getRepository(UserInvoice);
            await invoiceRepo.update(invoice.id, { status: 'paid' });

            // Update user balance
            const amount = amountToAdd !== undefined ? amountToAdd : parseFloat(invoice.amount.toString());
            await this.updateUserBalanceInTransaction(
                queryRunner,
                invoice.user,
                invoice.currency as InternalCurrency,
                amount
            );

            await queryRunner.commitTransaction();
            logger.info('[TransactionService] Invoice payment processed successfully');
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.errorHandler.logError(error, ErrorType.DATABASE_ERROR, {
                conversation: 'transaction_service',
                action: 'process_invoice_payment',
                data: { invoiceId: invoice.id }
            });
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Processes transfer with transaction safety
     */
    public async processTransfer(transfer: UserTransfer): Promise<{ transferId: string }> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            logger.info('[TransactionService] Processing transfer:', {
                transferId: transfer.id,
                amount: transfer.amount,
                currency: transfer.currency,
                senderId: transfer.sender.id,
                recipientId: transfer.recipientTelegramId
            });

            // Execute transfer via xRocket Pay
            const result = await this.xrocketPayService.createTransfer(transfer);

            // Update transfer record with transfer ID
            const transferRepo = queryRunner.manager.getRepository(UserTransfer);
            await transferRepo.update(transfer.id, { transferId: result.transferId });

            // Update sender balance (subtract amount)
            await this.updateUserBalanceInTransaction(
                queryRunner,
                transfer.sender,
                transfer.currency as InternalCurrency,
                -transfer.amount
            );

            await queryRunner.commitTransaction();
            logger.info('[TransactionService] Transfer processed successfully');
            return result;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'transaction_service',
                action: 'process_transfer',
                data: { transferId: transfer.id }
            });
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Processes withdrawal with transaction safety
     */
    public async processWithdrawal(withdrawal: UserWithdrawal): Promise<{ withdrawalId: string }> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            logger.info('[TransactionService] Processing withdrawal:', {
                withdrawalId: withdrawal.id,
                amount: withdrawal.amount,
                currency: withdrawal.currency,
                network: withdrawal.network
            });

            // Execute withdrawal via xRocket Pay
            const result = await this.xrocketPayService.createWithdrawal(withdrawal);

            // Update withdrawal record with withdrawal ID and status
            const withdrawalRepo = queryRunner.manager.getRepository(UserWithdrawal);
            await withdrawalRepo.update(withdrawal.id, {
                withdrawalId: result.withdrawalId,
                status: 'CREATED' // Initial status from xRocket Pay
            });

            // Update user balance (subtract amount)
            await this.updateUserBalanceInTransaction(
                queryRunner,
                withdrawal.user,
                withdrawal.currency as InternalCurrency,
                -withdrawal.amount
            );

            await queryRunner.commitTransaction();
            logger.info('[TransactionService] Withdrawal processed successfully');
            return result;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.errorHandler.logError(error, ErrorType.API_ERROR, {
                conversation: 'transaction_service',
                action: 'process_withdrawal',
                data: { withdrawalId: withdrawal.id }
            });
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Updates user balance within a transaction
     */
    private async updateUserBalanceInTransaction(
        queryRunner: any,
        user: any,
        currency: InternalCurrency,
        amountChange: number
    ): Promise<void> {
        const balanceRepo = queryRunner.manager.getRepository(UserBalance);
        
        // Find existing balance
        let balance = await balanceRepo.findOne({
            where: { user: { id: user.id }, coin: currency }
        });

        if (balance) {
            // Update existing balance
            const currentAmount = parseFloat(balance.amount.toString());
            const newAmount = currentAmount + amountChange;
            
            if (newAmount < 0) {
                throw new Error(`Insufficient balance. Current: ${currentAmount}, Required: ${Math.abs(amountChange)}`);
            }

            await balanceRepo.update(balance.id, { amount: newAmount });
            logger.info('[TransactionService] Updated existing balance:', {
                userId: user.id,
                currency,
                oldAmount: currentAmount,
                newAmount,
                change: amountChange
            });
        } else {
            // Create new balance if it doesn't exist
            if (amountChange < 0) {
                throw new Error(`Cannot create negative balance for currency: ${currency}`);
            }

            const newBalance = UserBalance.create(user, currency, amountChange);
            await balanceRepo.save(newBalance);
            logger.info('[TransactionService] Created new balance:', {
                userId: user.id,
                currency,
                amount: amountChange
            });
        }
    }

    /**
     * Updates user balance (public method for external use)
     */
    public async updateUserBalance(
        user: any,
        currency: InternalCurrency,
        amountChange: number
    ): Promise<void> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            await this.updateUserBalanceInTransaction(queryRunner, user, currency, amountChange);
            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Executes a transfer by creating transfer record and processing it
     */
    public async executeTransfer(
        sender: any,
        currency: string,
        amount: number,
        recipientTelegramId: string
    ): Promise<UserTransfer> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            logger.info('[TransactionService] Creating transfer record:', {
                senderId: sender.id,
                currency,
                amount,
                recipientTelegramId
            });

            // Create transfer record
            const transferRepo = queryRunner.manager.getRepository(UserTransfer);
            const transfer = UserTransfer.create(sender, parseInt(recipientTelegramId), null, amount, currency);
            const savedTransfer = await transferRepo.save(transfer);

            // Update sender balance (subtract amount) within the same transaction
            await this.updateUserBalanceInTransaction(
                queryRunner,
                sender,
                currency as InternalCurrency,
                -amount
            );

            // Commit transaction to release locks
            await queryRunner.commitTransaction();
            logger.info('[TransactionService] Transfer record created and balance updated');

            // Execute transfer via xRocket Pay AFTER committing transaction
            logger.info('[TransactionService] Calling xRocketPay API for transfer:', savedTransfer.id);
            let result;
            try {
                result = await this.xrocketPayService.createTransfer(savedTransfer);
            } catch (apiError) {
                this.errorHandler.logError(apiError, ErrorType.API_ERROR, {
                    conversation: 'transaction_service',
                    action: 'execute_transfer',
                    data: { senderId: sender.id, currency, amount, recipientTelegramId }
                });
                throw apiError;
            }

            // Update transfer record with transfer ID in a separate transaction
            const updateQueryRunner = AppDataSource.createQueryRunner();
            await updateQueryRunner.connect();
            await updateQueryRunner.startTransaction();

            try {
                const updateTransferRepo = updateQueryRunner.manager.getRepository(UserTransfer);
                await updateTransferRepo.update(savedTransfer.id, { transferId: result.transferId });
                await updateQueryRunner.commitTransaction();
                logger.info('[TransactionService] Transfer ID updated successfully');
            } catch (updateError) {
                await updateQueryRunner.rollbackTransaction();
                logger.error('[TransactionService] Failed to update transfer ID:', updateError);
                // Don't throw here as the transfer was successful, just log the error
            } finally {
                await updateQueryRunner.release();
            }

            // Get the updated transfer object
            const updatedTransfer = await AppDataSource.getRepository(UserTransfer).findOne({
                where: { id: savedTransfer.id }
            });

            if (!updatedTransfer) {
                throw new Error('Transfer record not found after processing');
            }

            logger.info('[TransactionService] Transfer executed successfully');
            return updatedTransfer;
        } catch (error) {
            // Only rollback if transaction hasn't been committed yet
            try {
                await queryRunner.rollbackTransaction();
            } catch (rollbackError) {
                // Transaction might already be committed or rolled back
                logger.warn('[TransactionService] Rollback failed, transaction might already be committed:', rollbackError);
            }
            
            // Determine error type - preserve API errors
            const errorType = (error && typeof error === 'object' && 'response' in error) 
                ? ErrorType.API_ERROR 
                : ErrorType.DATABASE_ERROR;
            
            this.errorHandler.logError(error, errorType, {
                conversation: 'transaction_service',
                action: 'execute_transfer',
                data: { senderId: sender.id, currency, amount, recipientTelegramId }
            });
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Executes a withdrawal by creating withdrawal record and processing it
     */
    public async executeWithdrawal(
        user: any,
        amount: number,
        currency: string,
        fee: number,
        network: string,
        address: string
    ): Promise<UserWithdrawal> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            logger.info('[TransactionService] Creating withdrawal record:', {
                userId: user.id,
                amount,
                currency,
                fee,
                network,
                address
            });

            // Create withdrawal record
            const withdrawalRepo = queryRunner.manager.getRepository(UserWithdrawal);
            const withdrawal = UserWithdrawal.create(user, amount, currency, fee, network as WithdrawalNetwork, address);
            const savedWithdrawal = await withdrawalRepo.save(withdrawal);

            // Update user balance (subtract amount) within the same transaction
            await this.updateUserBalanceInTransaction(
                queryRunner,
                user,
                currency as InternalCurrency,
                -amount
            );

            // Commit transaction to release locks
            await queryRunner.commitTransaction();
            logger.info('[TransactionService] Withdrawal record created and balance updated');

            // Execute withdrawal via xRocket Pay AFTER committing transaction
            logger.info('[TransactionService] Calling xRocketPay API for withdrawal:', savedWithdrawal.id);
            let result;
            try {
                result = await this.xrocketPayService.createWithdrawal(savedWithdrawal);
            } catch (apiError) {
                this.errorHandler.logError(apiError, ErrorType.API_ERROR, {
                    conversation: 'transaction_service',
                    action: 'execute_withdrawal',
                    data: { userId: user.id, amount, currency, fee, network, address }
                });
                throw apiError;
            }

            // Update withdrawal record with withdrawal ID and status in a separate transaction
            const updateQueryRunner = AppDataSource.createQueryRunner();
            await updateQueryRunner.connect();
            await updateQueryRunner.startTransaction();

            try {
                const updateWithdrawalRepo = updateQueryRunner.manager.getRepository(UserWithdrawal);
                await updateWithdrawalRepo.update(savedWithdrawal.id, {
                    withdrawalId: result.withdrawalId,
                    status: 'CREATED' // Initial status from xRocket Pay
                });
                await updateQueryRunner.commitTransaction();
                logger.info('[TransactionService] Withdrawal ID and status updated successfully');
            } catch (updateError) {
                await updateQueryRunner.rollbackTransaction();
                logger.error('[TransactionService] Failed to update withdrawal ID and status:', updateError);
                // Don't throw here as the withdrawal was successful, just log the error
            } finally {
                await updateQueryRunner.release();
            }

            // Get the updated withdrawal object
            const updatedWithdrawal = await AppDataSource.getRepository(UserWithdrawal).findOne({
                where: { id: savedWithdrawal.id }
            });

            if (!updatedWithdrawal) {
                throw new Error('Withdrawal record not found after processing');
            }

            logger.info('[TransactionService] Withdrawal executed successfully');
            return updatedWithdrawal;
        } catch (error) {
            // Only rollback if transaction hasn't been committed yet
            try {
                await queryRunner.rollbackTransaction();
            } catch (rollbackError) {
                // Transaction might already be committed or rolled back
                logger.warn('[TransactionService] Rollback failed, transaction might already be committed:', rollbackError);
            }
            
            // Determine error type - preserve API errors
            const errorType = (error && typeof error === 'object' && 'response' in error) 
                ? ErrorType.API_ERROR 
                : ErrorType.DATABASE_ERROR;
            
            this.errorHandler.logError(error, errorType, {
                conversation: 'transaction_service',
                action: 'execute_withdrawal',
                data: { userId: user.id, amount, currency, fee, network, address }
            });
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
} 