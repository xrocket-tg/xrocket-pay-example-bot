import { XRocketPayClient } from 'xrocket-pay-api-sdk';
import { UserInvoice } from '../entities/user-invoice';
import { AppDataSource } from '../config/database';
import { CurrencyConverter, InternalCurrency } from '../types/currency';

export class XRocketPayService {
    private static instance: XRocketPayService;
    private client: XRocketPayClient;

    private constructor() {
        this.client = new XRocketPayClient({
            apiKey: process.env.XROCKET_API_KEY || '',
            timeout: 30000
        });
    }

    public static getInstance(): XRocketPayService {
        if (!XRocketPayService.instance) {
            XRocketPayService.instance = new XRocketPayService();
        }
        return XRocketPayService.instance;
    }

    /**
     * Creates a new payment invoice
     */
    public async createInvoice(userInvoice: UserInvoice): Promise<{ paymentUrl: string; invoiceId: string }> {
        try {
            // Convert internal currency to external currency for XRocket Pay API
            const externalCurrency = CurrencyConverter.toExternal(userInvoice.currency as InternalCurrency);
            
            // Create callback URL to redirect back to bot
            const callbackUrl = `https://t.me/${process.env.BOT_USERNAME || 'xrocketpay_example_bot'}?start=invoice_${userInvoice.id}`;
            
            const response = await this.client.createInvoice({
                amount: userInvoice.amount,
                currency: externalCurrency,
                description: `Deposit for user ${userInvoice.user.telegramId}`,
                numPayments: 1,
                expiredIn: 3600, // 1 hour expiration
                callbackUrl: callbackUrl
            });

            if (!response.success || !response.data) {
                throw new Error('Failed to create invoice');
            }

            // Update invoice with payment URL and invoice ID
            const invoiceRepo = AppDataSource.getRepository(UserInvoice);
            await invoiceRepo.update(userInvoice.id, {
                status: 'active',
                invoiceId: response.data.id.toString(),
                paymentUrl: response.data.link
            });

            return {
                paymentUrl: response.data.link,
                invoiceId: response.data.id.toString()
            };
        } catch (error) {
            console.error('Error creating invoice:', error);
            throw error;
        }
    }

    /**
     * Checks invoice status
     */
    public async checkInvoiceStatus(invoiceId: string): Promise<string> {
        try {
            const response = await this.client.getInvoice(invoiceId);
            console.log('XRocketPay getInvoice response:', response);
            
            if (!response.success || !response.data) {
                throw new Error('Failed to get invoice status');
            }

            console.log('XRocketPay invoice data:', response.data);
            console.log('XRocketPay status field:', response.data.status);
            
            return response.data.status;
        } catch (error) {
            console.error('Error checking invoice status:', error);
            throw error;
        }
    }

    /**
     * Deletes an invoice
     */
    public async deleteInvoice(invoiceId: string): Promise<boolean> {
        try {
            const response = await this.client.deleteInvoice(invoiceId);
            
            if (!response.success) {
                throw new Error('Failed to delete invoice');
            }

            return true;
        } catch (error) {
            console.error('Error deleting invoice:', error);
            throw error;
        }
    }
} 