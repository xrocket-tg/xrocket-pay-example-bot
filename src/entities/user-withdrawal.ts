import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from './user';
import { WithdrawalNetwork } from '../types/currency';

export type WithdrawalStatus = 'CREATED' | 'COMPLETED' | 'FAIL';

@Entity('user_withdrawals')
export class UserWithdrawal {
    @PrimaryGeneratedColumn()
    id!: number; // Local DB ID

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    withdrawalId!: string | null; // xRocket Pay Withdrawal ID

    @Column({ type: 'varchar', length: 10, nullable: false })
    currency!: string;

    @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
    amount!: number; // Withdrawal amount

    @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
    fee!: number; // Withdrawal fee

    @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
    netAmount!: number; // Amount after fee deduction

    @Column({ 
        type: 'enum', 
        enum: ['CREATED', 'COMPLETED', 'FAIL'], 
        default: 'CREATED' 
    })
    status!: WithdrawalStatus;

    @Column({ 
        type: 'enum', 
        enum: ['TON', 'BSC', 'ETH', 'BTC', 'TRX', 'SOL'], 
        nullable: false 
    })
    network!: WithdrawalNetwork;

    @Column({ type: 'varchar', length: 255, nullable: false })
    address!: string; // External wallet address (matches SDK field name)

    @Column({ type: 'varchar', length: 255, nullable: true })
    comment!: string | null; // Withdrawal comment (matches SDK field name)

    @Column({ type: 'varchar', length: 255, nullable: true })
    txHash!: string | null; // Transaction hash (matches SDK field name)

    @Column({ type: 'varchar', length: 255, nullable: true })
    txLink!: string | null; // Transaction link (matches SDK field name)

    @Column({ type: 'text', nullable: true })
    error!: string | null; // Error message if withdrawal failed (matches SDK field name)

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    /**
     * Factory method to create a new UserWithdrawal instance
     */
    static create(
        user: User,
        amount: number,
        currency: string,
        fee: number,
        network: WithdrawalNetwork,
        address: string,
        withdrawalId?: string,
        status?: WithdrawalStatus,
        comment?: string,
        txHash?: string,
        txLink?: string,
        error?: string
    ): UserWithdrawal {
        const withdrawal = new UserWithdrawal();
        withdrawal.user = user;
        withdrawal.userId = user.id;
        withdrawal.withdrawalId = withdrawalId || null;
        withdrawal.amount = amount;
        withdrawal.currency = currency;
        withdrawal.fee = fee;
        withdrawal.netAmount = amount - fee;
        withdrawal.network = network;
        withdrawal.address = address;
        withdrawal.status = status || 'CREATED';
        withdrawal.comment = comment || null;
        withdrawal.txHash = txHash || null;
        withdrawal.txLink = txLink || null;
        withdrawal.error = error || null;
        return withdrawal;
    }
} 