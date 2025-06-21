import { DataSource } from "typeorm";
import { User } from "../entities/user";
import { UserBalance } from "../entities/user-balance";
import * as dotenv from 'dotenv';
import { UserInvoice } from "../entities/user-invoice";
import { UserTransfer } from "../entities/user-transfer";
import { UserCheque } from "../entities/user-cheque";

dotenv.config();

/**
 * Database configuration constants
 */
const DATABASE_CONFIG = {
    HOST: process.env.DATABASE_HOST || 'localhost',
    PORT: parseInt(process.env.DATABASE_PORT || '3306', 10),
    USERNAME: process.env.DATABASE_USERNAME || 'root',
    PASSWORD: process.env.DATABASE_PASSWORD || '',
    NAME: process.env.DATABASE_NAME || 'xrocket_pay_bot',
} as const;

/**
 * TypeORM DataSource configuration for the application
 */
export const AppDataSource = new DataSource({
    type: "mysql",
    host: DATABASE_CONFIG.HOST,
    port: DATABASE_CONFIG.PORT,
    username: DATABASE_CONFIG.USERNAME,
    password: DATABASE_CONFIG.PASSWORD,
    database: DATABASE_CONFIG.NAME,
    synchronize: true,
    logging: ["error", "warn"],
    entities: [User, UserBalance, UserInvoice, UserTransfer, UserCheque],
    subscribers: [],
    migrations: [],
}); 