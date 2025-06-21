import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./user";

/**
 * Represents a user's balance for a specific cryptocurrency
 */
@Entity({ name: "user_balances" })
export class UserBalance {
    @PrimaryGeneratedColumn()
    public readonly id!: number;

    @Column({ name: "amount", type: 'decimal', precision: 20, scale: 8 })
    public amount!: number;

    @Column({ name: "coin" })
    public readonly coin!: string;

    @ManyToOne(() => User, (user: User) => user.balances)
    @JoinColumn({ name: "user_id" })
    public readonly user!: User;

    @Column({ name: "created_at", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    public readonly createdAt!: Date;

    @Column({ name: "updated_at", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    public readonly updatedAt!: Date;

    /**
     * Creates a new user balance instance
     * @param user - The user who owns this balance
     * @param coin - The cryptocurrency type
     * @param amount - The initial amount
     */
    public static create(user: User, coin: string, amount: number): UserBalance {
        const balance = new UserBalance();
        Object.assign(balance, { user, coin, amount });
        return balance;
    }

    /**
     * Adds amount to the current balance
     * @param amount - The amount to add
     */
    public addAmount(amount: number): void {
        this.amount = this.amount + amount;
    }
} 