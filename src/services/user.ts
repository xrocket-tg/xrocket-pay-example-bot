import { AppDataSource } from "../config/database";
import { User } from "../entities/user";
import { UserBalance } from "../entities/user-balance";
import { BotContext } from "../types/bot";
import { InternalCurrency } from "../types/currency";

export class UserService {
    private static instance: UserService;

    private constructor() {}

    public static getInstance(): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService();
        }
        return UserService.instance;
    }

    /**
     * Gets or creates a user based on Telegram context
     * @param ctx - The bot context
     * @returns The user instance
     */
    public async findOrCreateUser(ctx: BotContext): Promise<User> {
        const userRepo = AppDataSource.getRepository(User);
        const telegramId = ctx.from?.id;
        
        if (!telegramId) {
            throw new Error("Telegram ID not found in context");
        }

        let user = await userRepo.findOne({ where: { telegramId } });

        if (!user && ctx.from) {
            user = User.create(
                telegramId,
                ctx.from.username || `user_${telegramId}`
            );
            await userRepo.save(user);
        }

        return user!;
    }

    /**
     * Gets user by Telegram ID
     * @param telegramId - The Telegram user ID
     * @returns The user instance or null if not found
     */
    public async getUserByTelegramId(telegramId: number): Promise<User | null> {
        const userRepo = AppDataSource.getRepository(User);
        return await userRepo.findOne({ where: { telegramId } });
    }

    /**
     * Gets user balances from database
     * @param user - The user instance
     * @returns Array of user balances
     */
    public async getUserBalances(user: User): Promise<UserBalance[]> {
        const balanceRepo = AppDataSource.getRepository(UserBalance);
        return await balanceRepo.find({ where: { user: { id: user.id } } });
    }

    /**
     * Gets user balance for specific currency
     * @param user - The user instance
     * @param currency - The currency to get balance for
     * @returns The balance instance or null if not found
     */
    public async getUserBalance(user: User, currency: InternalCurrency): Promise<UserBalance | null> {
        const balanceRepo = AppDataSource.getRepository(UserBalance);
        return await balanceRepo.findOne({ 
            where: { user: { id: user.id }, coin: currency }
        });
    }

    /**
     * Updates user balance with validation
     * @param user - The user instance
     * @param currency - The currency to update
     * @param amount - The amount to add/subtract (positive for add, negative for subtract)
     * @returns The updated balance instance
     */
    public async updateBalance(user: User, currency: InternalCurrency, amount: number): Promise<UserBalance> {
        if (typeof amount !== 'number' || isNaN(amount)) {
            throw new Error("Invalid amount provided");
        }

        const balanceRepo = AppDataSource.getRepository(UserBalance);
        let balance = await this.getUserBalance(user, currency);
        
        if (!balance) {
            // Create new balance if it doesn't exist
            balance = UserBalance.create(user, currency, 0);
        }

        // Update balance
        const currentAmount = parseFloat(balance.amount.toString());
        const newAmount = currentAmount + amount;
        
        if (newAmount < 0) {
            throw new Error(`Insufficient balance. Current: ${currentAmount}, Requested: ${Math.abs(amount)}`);
        }

        balance.amount = newAmount;
        
        return await balanceRepo.save(balance);
    }

    /**
     * Creates or updates user balance (for deposits)
     * @param user - The user instance
     * @param currency - The currency
     * @param amount - The amount to set
     * @returns The balance instance
     */
    public async setBalance(user: User, currency: InternalCurrency, amount: number): Promise<UserBalance> {
        if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
            throw new Error("Invalid amount provided");
        }

        const balanceRepo = AppDataSource.getRepository(UserBalance);
        let balance = await this.getUserBalance(user, currency);
        
        if (!balance) {
            // Create new balance if it doesn't exist
            balance = UserBalance.create(user, currency, amount);
        } else {
            balance.amount = amount;
        }
        
        return await balanceRepo.save(balance);
    }
} 