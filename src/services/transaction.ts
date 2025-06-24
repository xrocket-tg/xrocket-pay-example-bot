import { AppDataSource } from "../config/database";
import { UserInvoice } from "../entities/user-invoice";
import { UserTransfer } from "../entities/user-transfer";
import { UserWithdrawal } from "../entities/user-withdrawal";
import { UserBalance } from "../entities/user-balance";
import { UserService } from "./user";
import { XRocketPayService } from "./xrocket-pay";
import logger from "../utils/logger";
import { InternalCurrency } from "../types/currency";

export class TransactionService {
    private static instance: TransactionService;
    private userService: UserService;
    private xrocketPayService: XRocketPayService;

    private constructor() {
        this.userService = UserService.getInstance();
        this.xrocketPayService = XRocketPayService.getInstance();
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
    public async processInvoicePayment(invoice: UserInvoice): Promise<void> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            logger.info('[TransactionService] Processing invoice payment:', {
                invoiceId: invoice.id,
                amount: invoice.amount,
                currency: invoice.currency
            });

            // Update invoice status
            const invoiceRepo = queryRunner.manager.getRepository(UserInvoice);
            await invoiceRepo.update(invoice.id, { status: 'paid' });

            // Update user balance
            const amountToAdd = parseFloat(invoice.amount.toString());
            await this.updateUserBalanceInTransaction(
                queryRunner,
                invoice.user,
                invoice.currency as InternalCurrency,
                amountToAdd
            );

            await queryRunner.commitTransaction();
            logger.info('[TransactionService] Invoice payment processed successfully');
        } catch (error) {
            await queryRunner.rollbackTransaction();
            logger.error('[TransactionService] Error processing invoice payment:', error);
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
            logger.error('[TransactionService] Error processing transfer:', error);
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
            logger.error('[TransactionService] Error processing withdrawal:', error);
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
} 