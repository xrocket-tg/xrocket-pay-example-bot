import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from './user';

export type ChequeStatus = 'active' | 'completed' | 'draft';

@Entity('user_cheques')
export class UserCheque {
    @PrimaryGeneratedColumn()
    id!: number; // Local DB ID

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ type: 'bigint', nullable: true })
    chequeId!: number | null; // xRocket Pay Cheque ID

    @Column({ type: 'varchar', length: 10, nullable: false })
    currency!: string;

    @Column({ type: 'decimal', precision: 20, scale: 8, nullable: false })
    amount!: number; // Cheque amount

    @Column({ type: 'int', nullable: false })
    usersNumber!: number; // Number of users (always 1 for our use case)

    @Column({ type: 'varchar', length: 255, nullable: true })
    link!: string | null;

    @Column({ 
        type: 'enum', 
        enum: ['active', 'completed', 'draft'], 
        default: 'active' 
    })
    status!: ChequeStatus;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    /**
     * Factory method to create a new UserCheque instance
     */
    static create(
        user: User,
        amount: number,
        currency: string,
        usersNumber: number,
        chequeId?: number,
        link?: string,
        status?: ChequeStatus
    ): UserCheque {
        const cheque = new UserCheque();
        cheque.user = user;
        cheque.userId = user.id;
        cheque.chequeId = chequeId || null;
        cheque.amount = amount;
        cheque.currency = currency;
        cheque.usersNumber = usersNumber;
        cheque.link = link || null;
        cheque.status = status || 'active';
        return cheque;
    }
} 