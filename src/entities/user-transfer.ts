import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./user";

/**
 * Represents a transfer between users
 * Note: Transfers are atomic operations with no status field
 */
@Entity({ name: "user_transfers" })
export class UserTransfer {
    @PrimaryGeneratedColumn()
    public readonly id!: number;

    @Column({ name: "transfer_id", nullable: true })
    public transferId!: string;

    @Column({ name: "amount", type: 'decimal', precision: 20, scale: 8 })
    public readonly amount!: number;

    @Column({ name: "currency" })
    public readonly currency!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "sender_id" })
    public readonly sender!: User;

    @Column({ name: "recipient_telegram_id", type: 'bigint' })
    public readonly recipientTelegramId!: number;

    @Column({ name: "recipient_username", nullable: true })
    public readonly recipientUsername!: string;

    @Column({ name: "created_at", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    public readonly createdAt!: Date;

    @Column({ name: "updated_at", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    public readonly updatedAt!: Date;

    /**
     * Creates a new user transfer instance
     */
    public static create(
        sender: User,
        recipientTelegramId: number,
        recipientUsername: string | null,
        amount: number,
        currency: string
    ): UserTransfer {
        const transfer = new UserTransfer();
        Object.assign(transfer, {
            sender,
            recipientTelegramId,
            recipientUsername,
            amount,
            currency
        });
        return transfer;
    }
} 