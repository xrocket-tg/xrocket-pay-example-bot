import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { UserBalance } from "./user-balance";

/**
 * Supported languages for the bot
 */
export type SupportedLanguage = 'en' | 'ru';

/**
 * Represents a user in the system
 */
@Entity({ name: "users" })
export class User {
    @PrimaryGeneratedColumn()
    public readonly id!: number;

    @Column({ name: "telegram_id", type: 'bigint' })
    public readonly telegramId!: number;

    @Column({ name: "username" })
    public readonly username!: string;

    @Column({ name: "language", type: 'varchar', length: 2, nullable: true })
    public language?: SupportedLanguage;

    @Column({ name: "created_at", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    public readonly createdAt!: Date;

    @OneToMany(() => UserBalance, (balance: UserBalance) => balance.user)
    public readonly balances!: UserBalance[];

    /**
     * Creates a new user instance
     * @param telegramId - The user's Telegram ID
     * @param username - The user's username
     * @param language - The user's preferred language (optional)
     */
    public static create(telegramId: number, username: string, language?: SupportedLanguage): User {
        const user = new User();
        Object.assign(user, { telegramId, username, language });
        return user;
    }
} 