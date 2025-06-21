# Telegram Bot Architecture Documentation

## Overview
This document outlines the architectural design for a Telegram bot that demonstrates xrocket-pay payment system functionality. The bot provides deposit, withdrawal, and transaction history features using the xrocket-pay-api-sdk.

## Core Architecture Principles

### 1. Technology Stack
- **Bot Framework**: Grammy.js with session-based state management
- **Database**: MySQL with TypeORM
- **Payment Integration**: xrocket-pay-api-sdk
- **Language**: TypeScript with strict typing
- **Session Management**: RAM-based sessions (no persistence)

### 2. Design Patterns
- **Singleton Pattern**: For XRocketPay service
- **Repository Pattern**: For database operations
- **Factory Pattern**: For entity creation
- **Strategy Pattern**: For different withdrawal methods
- **Observer Pattern**: For webhook handling

### 3. Decimal Handling Best Practices
- **Database Storage**: Use `decimal(20,8)` for all monetary amounts to ensure precision
- **TypeScript Types**: Define amounts as `number` in entities but handle conversion carefully
- **Balance Updates**: Always convert decimal values using `parseFloat()` before arithmetic operations
- **String Concatenation Prevention**: Avoid `+=` operator on decimal fields; use explicit numeric addition
- **Example Implementation**:
  ```typescript
  // CORRECT: Convert to numbers before addition
  const currentAmount = parseFloat(balance.amount.toString());
  const invoiceAmount = parseFloat(invoice.amount.toString());
  balance.amount = currentAmount + invoiceAmount;
  
  // INCORRECT: Can cause string concatenation
  balance.amount += invoice.amount;
  ```

## Database Schema Architecture

### Core Entities

#### 1. User Entity
```typescript
- id: number (Primary Key)
- telegramId: number (Unique)
- username: string
- createdAt: Date
- balances: UserBalance[] (One-to-Many)
```

#### 2. UserBalance Entity
```typescript
- id: number (Primary Key)
- userId: number (Foreign Key)
- currency: string
- amount: decimal(20,8)
- updatedAt: Date
```

#### 3. UserInvoice Entity
```typescript
- id: number (Primary Key)
- userId: number (Foreign Key)
- invoiceId: string (XRocket Pay ID)
- paymentUrl: string
- amount: decimal(20,8)
- currency: string
- status: 'active' | 'paid' | 'expired' (matches XRocket Pay InvoiceDto.status)
- createdAt: Date
- updatedAt: Date
```

#### 4. UserTransfer Entity (New)
```typescript
- id: number (Primary Key)
- fromUserId: number (Foreign Key)
- toUserId: number (Foreign Key)
- transferId: string (XRocket Pay transfer ID)
- amount: decimal(20,8)
- currency: string
- description: string (optional)
- createdAt: Date
- updatedAt: Date
```
**Note**: Transfers are atomic operations in XRocket Pay - no status tracking needed.

#### 5. UserCheque Entity (New)
```typescript
- id: number (Primary Key)
- userId: number (Foreign Key)
- chequeId: number (XRocket Pay ID)
- amount: decimal(20,8)
- currency: string
- perUserAmount: decimal(20,8)
- usersNumber: number
- state: 'active' | 'completed' | 'draft' (matches XRocket Pay Cheque.state)
- link: string
- createdAt: Date
- updatedAt: Date
```

#### 6. UserWithdrawal Entity (New)
```typescript
- id: number (Primary Key)
- userId: number (Foreign Key)
- withdrawalId: string (XRocket Pay withdrawal ID)
- amount: decimal(20,8)
- currency: string
- network: 'TON' | 'BSC' | 'ETH' | 'BTC' | 'TRX' | 'SOL'
- address: string
- status: 'CREATED' | 'COMPLETED' | 'FAIL' (matches XRocket Pay WithdrawalDto.status)
- txHash: string (optional)
- txLink: string (optional)
- error: string (optional)
- createdAt: Date
- updatedAt: Date
```

## Bot Navigation Architecture

### Main Menu Structure
```
Main Menu
├── 💰 Deposit
├── 💸 Withdraw
│   ├── 🔄 Transfer to User
│   ├── 🎫 Multicheque
│   └── 🌐 External Wallet
├── �� My Invoices
└── 📊 My Withdrawals
    ├── 🎫 My Cheques
    ├── 🔄 My Transfers
    └── 🌐 My Blockchain Withdrawals
```

### Conversation Flow Architecture

#### 1. Deposit Flow (Session-Based)
```
Start → Choose Currency → Enter Amount → Create Invoice → Show Payment Link → Check Payment Status
```

#### 2. Withdrawal Flow
```
Start → Choose Withdrawal Type → Choose Currency → Enter Amount → Additional Data → Confirm → Execute
```

#### 3. History Flow
```
Start → Choose History Type → Paginated Results → Detail View (if applicable)
```

## Service Layer Architecture

### 1. XRocketPayService (Enhanced)
```typescript
class XRocketPayService {
  // Existing methods
  - createInvoice()
  - checkInvoiceStatus()
  
  // New methods based on actual SDK
  - createTransfer(transferData: CreateTransferDto): Promise<AppTransferResponse>
  - createMulticheque(chequeData: CreateChequeDto): Promise<SimpleChequeResponse>
  - createWithdrawal(withdrawalData: CreateWithdrawalDto): Promise<AppWithdrawalResponse>
  - getWithdrawalFees(currency?: string): Promise<WithdrawalFeesResponse>
  - getWithdrawalStatus(withdrawalId: string): Promise<WithdrawalStatusResponse>
  - getMulticheque(id: number): Promise<SimpleChequeResponse>
  - getMulticheques(params?: PaginationParams): Promise<PaginatedShortChequeDtoResponse>
}
```

### 2. UserService (New)
```typescript
class UserService {
  - findOrCreateUser()
  - getUserBalances()
  - updateBalance()
  - getUserByTelegramId()
}
```

### 3. TransactionService (New)
```typescript
class TransactionService {
  - processInvoicePayment()
  - processTransfer()
  - processWithdrawal()
  - updateUserBalance()
}
```

### 4. WebhookService (New)
```typescript
class WebhookService {
  - handleInvoiceWebhook()
  // Note: No transfer or withdrawal webhooks available in XRocket Pay API
}
```

## Conversation Architecture

### 1. DepositConversation (Session-Based)
```typescript
// Session-based approach (no Grammy.js conversations)
- handleDepositFlow() - Show currency selection
- handleCurrencySelection() - Process currency choice
- handleAmountInput() - Process amount and create invoice
```

### 2. WithdrawalConversation (New)
```typescript
class WithdrawalConversation {
  - selectWithdrawalType()
  - selectCurrency()
  - enterAmount()
  - enterAdditionalData()
  - confirmWithdrawal()
  - executeWithdrawal()
}
```

### 3. TransferConversation (New)
```typescript
class TransferConversation {
  - selectCurrency()
  - enterAmount()
  - enterRecipientTelegramId()
  - confirmTransfer()
  - executeTransfer()
}
```

### 4. MultichequeConversation (New)
```typescript
class MultichequeConversation {
  - selectCurrency()
  - enterAmount()
  - enterUsersNumber()
  - confirmCheque()
  - createCheque()
}
```

### 5. ExternalWithdrawalConversation (New)
```typescript
class ExternalWithdrawalConversation {
  - selectCurrency()
  - enterAmount()
  - showFees()
  - selectNetwork()
  - enterWalletAddress()
  - confirmWithdrawal()
  - executeWithdrawal()
}
```

## Handler Architecture

### 1. Command Handlers
```typescript
- handleStart() - Main menu
- handleHelp() - Help information
```

### 2. Callback Handlers
```typescript
- handleDeposit() - Start deposit flow
- handleWithdraw() - Start withdrawal flow
- handleMyInvoices() - Show invoice history
- handleMyWithdrawals() - Show withdrawal history
- handleCheckPayment() - Check payment status
- handleInvoiceDetail() - Show invoice details
- handleWithdrawalDetail() - Show withdrawal details
```

## Keyboard Architecture

### 1. Main Menu Keyboard
```typescript
- Deposit button
- Withdraw button
- My Invoices button
- My Withdrawals button
```

### 2. Withdrawal Type Keyboard
```typescript
- Transfer to User button
- Multicheque button
- External Wallet button
```

### 3. Currency Selection Keyboard
```typescript
- Dynamic currency buttons based on available currencies
- Back button
```

### 4. History Navigation Keyboard
```typescript
- Pagination buttons (Previous/Next)
- Detail view buttons
- Back to main menu button
```

## Currency Mapping Architecture

### Internal vs External Currency Mapping
```typescript
const CURRENCY_MAP = {
  'TON': 'TONCOIN',
  'BTC': 'BITCOIN',
  'ETH': 'ETHEREUM',
  // ... other mappings
};

class CurrencyConverter {
  - toExternal(internal: InternalCurrency): ExternalCurrency
  - toInternal(external: ExternalCurrency): InternalCurrency
}
```

## Transaction Management Architecture

### Database Transaction Wrapper
```typescript
class TransactionManager {
  - async executeInTransaction<T>(operation: () => Promise<T>): Promise<T>
  - async updateBalanceWithTransaction(userId: number, currency: string, amount: number): Promise<void>
}
```

## Error Handling Architecture

### 1. Bot Error Handler
```typescript
- Global error catching
- User-friendly error messages
- Logging for debugging
```

### 2. Service Error Handling
```typescript
- XRocket Pay API errors
- Database transaction errors
- Validation errors
```

## Webhook Architecture

### 1. Webhook Endpoints
```typescript
- POST /webhook/invoice - Invoice payment events only
- // Note: No transfer or withdrawal webhooks available in XRocket Pay API
```

### 2. Webhook Processing
```typescript
- Signature verification using HMAC-SHA-256
- Invoice payment status updates
- Database updates for invoice status
- User balance updates in transaction
- User notifications
```

### 3. Webhook Types
```typescript
// Only one webhook type available in XRocket Pay API
interface InvoicePaymentWebhook {
  type: 'invoicePay';
  timestamp: string;
  data: PayInvoiceDto;
}
```

## Security Architecture

### 1. Input Validation
```typescript
- Amount validation (positive numbers, decimal places)
- Currency validation (whitelist)
- Telegram ID validation
- Wallet address validation
```

## Configuration Architecture

### Environment Variables
```typescript
- BOT_TOKEN: Telegram bot token
- XROCKET_API_KEY: XRocket Pay API key
- DATABASE_URL: Database connection string
- WEBHOOK_SECRET: Webhook signature secret
- SUPPORTED_CURRENCIES: Comma-separated currency list
```

## Deployment Architecture

### 1. Development Environment
```typescript
- Local MySQL database
- Local bot testing
- Webhook tunneling (ngrok)
```

### 2. Production Environment
```typescript
- Production MySQL database
- SSL-enabled webhook endpoints
- Backup strategies
```

## Performance Considerations

### 1. Database Optimization
```typescript
- Indexed foreign keys
- Pagination for history queries
- Connection pooling
```

### 2. Bot Performance
```typescript
- Session cleanup
- Memory management
- Response time optimization
```

This architecture provides a scalable, maintainable, and secure foundation for the Telegram bot payment system while following TypeScript best practices and the specified project requirements. 