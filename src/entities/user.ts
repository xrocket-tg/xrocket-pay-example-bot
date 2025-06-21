import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { UserBalance } from "./user-balance";

/**
 * Represents a user in the system
 */
@Entity({ name: "users" })
export class User {
    @PrimaryGeneratedColumn()
    public readonly id!: number;

    @Column({ name: "telegram_id" })
    public readonly telegramId!: number;

    @Column({ name: "username" })
    public readonly username!: string;

    @Column({ name: "created_at", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    public readonly createdAt!: Date;

    @OneToMany(() => UserBalance, (balance: UserBalance) => balance.user)
    public readonly balances!: UserBalance[];

    /**
     * Creates a new user instance
     * @param telegramId - The user's Telegram ID
     * @param username - The user's username
     */
    public static create(telegramId: number, username: string): User {
        const user = new User();
        Object.assign(user, { telegramId, username });
        return user;
    }
} 