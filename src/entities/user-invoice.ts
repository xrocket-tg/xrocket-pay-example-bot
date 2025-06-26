import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./user";

/**
 * Represents a payment invoice for a user
 */
@Entity({ name: "user_invoices" })
export class UserInvoice {
    @PrimaryGeneratedColumn()
    public readonly id!: number;

    @Column({ name: "invoice_id", nullable: true })
    public invoiceId!: string;

    @Column({ name: "payment_url", nullable: true })
    public paymentUrl!: string;

    @Column({ name: "amount", type: 'decimal', precision: 20, scale: 8 })
    public readonly amount!: number;

    @Column({ name: "payment_amount_received", type: 'decimal', precision: 20, scale: 8, nullable: true })
    public paymentAmountReceived?: number;

    @Column({ name: "currency" })
    public readonly currency!: string;

    @Column({ name: "status", default: 'active' })
    public status!: 'active' | 'paid' | 'expired';

    @ManyToOne(() => User)
    @JoinColumn({ name: "user_id" })
    public readonly user!: User;

    @Column({ name: "created_at", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    public readonly createdAt!: Date;

    @Column({ name: "updated_at", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    public readonly updatedAt!: Date;

    /**
     * Creates a new user invoice instance
     */
    public static create(user: User, amount: number, currency: string): UserInvoice {
        const invoice = new UserInvoice();
        Object.assign(invoice, { user, amount, currency, status: 'active' });
        return invoice;
    }
} 