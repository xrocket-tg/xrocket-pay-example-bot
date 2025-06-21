# Implementation Plan

## Overview
This document outlines the step-by-step implementation plan for the Telegram bot payment system. Each phase is designed to be no more than 200-400 lines of code and includes comprehensive manual testing steps.

## Phase 1: Fix Current Issues & Complete Core Infrastructure

### Step 1.1: Fix UserInvoice Status Mismatch (~50 lines) ✅ **COMPLETED**

**Files modified:**
- `src/entities/user-invoice.ts` - Removed 'failed' status
- `src/bot/handlers/callbacks.ts` - Updated status handling

**Changes completed:**
- ✅ Removed 'failed' from status union type
- ✅ Updated status handling to match XRocket Pay API
- ✅ Fixed decimal handling in balance updates (parseFloat conversion)
- ✅ Implemented session-based deposit flow (removed conversations)
- ✅ Added balance display after payment confirmation
- ✅ Added callback URL to invoices for seamless user return flow after payment
- ✅ Added automatic status synchronization with XRocket Pay API when viewing invoice details
- ✅ Updated invoice detail keyboard to hide buttons for expired invoices and show correct status emojis

**Manual Testing completed:**
- ✅ Create a new deposit invoice
- ✅ Check that invoice shows 'active' status
- ✅ Verify status emoji displays correctly
- ✅ Test payment flow and verify status changes to 'paid'
- ✅ Test balance updates with proper decimal handling
- ✅ Verify balance display after payment confirmation
- ✅ Test "My Invoices" button functionality
- ✅ Verify invoice list displays correctly
- ✅ Test invoice detail view
- ✅ Test payment link generation and display
- ✅ Test "Check Payment" functionality from invoice detail
- ✅ Test callback URL functionality after payment completion
- ✅ Test invoice status synchronization for expired invoices

**Key fixes implemented:**
- **Decimal handling**: Fixed balance update logic to properly convert decimal values to numbers using `parseFloat()` to prevent string concatenation
- **Session-based flow**: Replaced Grammy.js conversations with simple session-based state management
- **Balance display**: Added comprehensive balance display after payment confirmation
- **Invoice management**: Verified complete invoice lifecycle from creation to payment confirmation
- **Callback URL**: Added callback URL to invoices for seamless user return flow after payment
- **Invoice status sync**: Added automatic status synchronization with XRocket Pay API when viewing invoice details
- **Enhanced UI**: Updated invoice detail keyboard to hide buttons for expired invoices and show correct status emojis

**Remaining testing needed:**
- [ ] Test "My Invoices" with multiple invoices (pagination if needed)
- [ ] Test "My Invoices" with no invoices (empty state)
- [ ] Test invoice detail view with different statuses (active, paid, expired)
- [ ] Test payment link accessibility and functionality
- [ ] Test "Check Payment" button with various payment states
- [ ] Test callback URL functionality after payment completion
- [ ] Test invoice status synchronization for expired invoices

---

### Step 1.2: Add Missing Main Menu Buttons (~100 lines) ✅ **COMPLETED**

**Files to modify:**
- `src/bot/keyboards/main.ts` - Add withdraw buttons
- `src/bot/index.ts` - Register new callback handlers
- `src/bot/handlers/callbacks.ts` - Add placeholder handlers

**Changes:**
- Add "💸 Withdraw" and "📊 My Withdrawals" buttons to main menu
- Register callback handlers for new buttons
- Add placeholder handler functions that show "Coming Soon" messages

**Manual Testing:**
1. Start bot with `/start`
2. Verify main menu shows all 4 buttons
3. Click "💸 Withdraw" - should show "Coming Soon"
4. Click "📊 My Withdrawals" - should show "Coming Soon"
5. Verify existing "💰 Deposit" and "📋 My Invoices" still work

**Completed features in Step 1.2:**
- ✅ Added "💸 Withdraw" button to main menu
- ✅ Added "📊 My Withdrawals" button to main menu
- ✅ Added placeholder handlers with "Coming Soon" messages
- ✅ Registered callback handlers in bot
- ✅ Maintained existing functionality

---

### Step 1.3: Create UserService (~150 lines)

**New file:** `src/services/user.ts`

**Implementation:**
- `findOrCreateUser()` - Move from utils to service
- `getUserBalances()` - Get all user balances
- `updateBalance()` - Update user balance with validation
- `getUserByTelegramId()` - Find user by Telegram ID

**Manual Testing:**
1. Test user creation for new users
2. Test user retrieval for existing users
3. Test balance updates with valid amounts
4. Test balance updates with invalid amounts (should fail)
5. Verify all existing functionality still works

---

## Phase 2: Implement Transfer Functionality

### Step 2.1: Create UserTransfer Entity (~80 lines)

**New file:** `src/entities/user-transfer.ts`

**Implementation:**
- Entity with all required fields (no status field)
- Factory method for creation
- Proper TypeORM decorators and relationships

**Manual Testing:**
1. Run database migrations
2. Verify table creation in database
3. Test entity creation with valid data
4. Test entity creation with invalid data (should fail)

---

### Step 2.2: Add Transfer Methods to XRocketPayService (~100 lines)

**File to modify:** `src/services/xrocket-pay.ts`

**Implementation:**
- `createTransfer()` method using SDK
- Proper currency mapping
- Error handling and validation

**Manual Testing:**
1. Test transfer creation with valid data
2. Test transfer creation with invalid Telegram ID
3. Test transfer creation with invalid currency
4. Test transfer creation with invalid amount
5. Verify currency mapping works correctly

---

### Step 2.3: Create TransferConversation (~200 lines)

**New file:** `src/bot/conversations/transfer.ts`

**Implementation:**
- Currency selection
- Amount input with validation
- Recipient Telegram ID input
- Confirmation step
- Transfer execution

**Manual Testing:**
1. Start transfer flow
2. Test currency selection
3. Test amount validation (positive numbers, decimals)
4. Test recipient ID validation
5. Test confirmation step
6. Test actual transfer execution (with test data)
7. Verify transfer is recorded in database

---

### Step 2.4: Add Transfer Handlers and Keyboards (~150 lines)

**Files to modify:**
- `src/bot/handlers/callbacks.ts` - Add transfer handlers
- `src/bot/keyboards/transfer.ts` - Create transfer keyboards
- `src/bot/index.ts` - Register transfer conversation

**Implementation:**
- Transfer keyboard layouts
- Transfer history handler
- Transfer detail handler
- Register transfer conversation

**Manual Testing:**
1. Test transfer flow from main menu
2. Test transfer history display
3. Test transfer detail view
4. Verify all keyboard navigation works
5. Test back buttons and menu navigation

---

## Phase 3: Implement Multicheque Functionality

### Step 3.1: Create UserCheque Entity (~100 lines)

**New file:** `src/entities/user-cheque.ts`

**Implementation:**
- Entity with all required fields
- State field with correct values
- Factory method for creation

**Manual Testing:**
1. Run database migrations
2. Verify table creation
3. Test entity creation with valid data
4. Test state transitions

---

### Step 3.2: Add Multicheque Methods to XRocketPayService (~120 lines)

**File to modify:** `src/services/xrocket-pay.ts`

**Implementation:**
- `createMulticheque()` method
- `getMulticheque()` method
- `getMulticheques()` method
- Proper error handling

**Manual Testing:**
1. Test multicheque creation
2. Test multicheque retrieval
3. Test multicheque listing
4. Verify all API responses are handled correctly

---

### Step 3.3: Create MultichequeConversation (~250 lines)

**New file:** `src/bot/conversations/multicheque.ts`

**Implementation:**
- Currency selection
- Amount input
- Users number input
- Confirmation step
- Cheque creation

**Manual Testing:**
1. Test complete multicheque flow
2. Test all input validations
3. Test confirmation step
4. Test actual cheque creation
5. Verify cheque is recorded in database

---

## Phase 4: Implement External Withdrawal Functionality

### Step 4.1: Create UserWithdrawal Entity (~120 lines)

**New file:** `src/entities/user-withdrawal.ts`

**Implementation:**
- Entity with all required fields
- Status field with correct values
- Network field with correct values
- Factory method for creation

**Manual Testing:**
1. Run database migrations
2. Verify table creation
3. Test entity creation with valid data
4. Test status field validation

---

### Step 4.2: Add Withdrawal Methods to XRocketPayService (~150 lines)

**File to modify:** `src/services/xrocket-pay.ts`

**Implementation:**
- `createWithdrawal()` method
- `getWithdrawalFees()` method
- `getWithdrawalStatus()` method
- Fee calculation logic

**Manual Testing:**
1. Test withdrawal fee retrieval
2. Test withdrawal creation
3. Test withdrawal status checking
4. Verify fee calculations are correct

---

### Step 4.3: Create ExternalWithdrawalConversation (~300 lines)

**New file:** `src/bot/conversations/external-withdrawal.ts`

**Implementation:**
- Currency selection
- Amount input
- Fee display
- Network selection
- Wallet address input
- Confirmation step
- Withdrawal execution

**Manual Testing:**
1. Test complete withdrawal flow
2. Test fee display
3. Test network selection
4. Test wallet address validation
5. Test confirmation step
6. Test actual withdrawal creation
7. Verify withdrawal is recorded in database

---

## Phase 5: Implement History and Status Tracking

### Step 5.1: Create TransactionService (~200 lines)

**New file:** `src/services/transaction.ts`

**Implementation:**
- `processInvoicePayment()` method
- `processTransfer()` method
- `processWithdrawal()` method
- `updateUserBalance()` method
- Transaction wrapper methods

**Manual Testing:**
1. Test invoice payment processing
2. Test transfer processing
3. Test withdrawal processing
4. Test balance updates
5. Test transaction rollbacks on errors

---

### Step 5.2: Implement History Handlers (~200 lines)

**Files to modify:**
- `src/bot/handlers/callbacks.ts` - Add history handlers
- `src/bot/keyboards/history.ts` - Create history keyboards

**Implementation:**
- My Withdrawals handler
- My Transfers handler
- My Cheques handler
- Pagination support
- Detail views

**Manual Testing:**
1. Test withdrawal history display
2. Test transfer history display
3. Test cheque history display
4. Test pagination
5. Test detail views
6. Test navigation between different history types

---

## Phase 6: Implement Webhook Handling

### Step 6.1: Create WebhookService (~150 lines)

**New file:** `src/services/webhook.ts`

**Implementation:**
- `handleInvoiceWebhook()` method
- Signature verification
- Invoice status updates
- Balance updates in transaction

**Manual Testing:**
1. Test webhook signature verification
2. Test invoice payment processing via webhook
3. Test balance updates via webhook
4. Test error handling for invalid webhooks
5. Test webhook endpoint accessibility

---

### Step 6.2: Add Webhook Endpoint (~100 lines)

**File to modify:** `src/index.ts` or create new webhook handler

**Implementation:**
- Webhook endpoint setup
- Request body parsing
- Webhook service integration
- Error handling

**Manual Testing:**
1. Test webhook endpoint accessibility
2. Test webhook processing with valid data
3. Test webhook processing with invalid data
4. Test webhook signature verification
5. Verify database updates via webhook

---

## Phase 7: Final Enhancement

### Step 7.1: Subtract XRocket Pay Fee After Deposit (~100 lines)

**Files to modify:**
- `src/services/xrocket-pay.ts` - Add method to get fee for deposit
- `src/bot/handlers/callbacks.ts` and/or deposit flow - Subtract fee from credited amount
- `src/services/user.ts` - Update balance logic if needed

**Implementation:**
- Call XRocket Pay API to get the fee for the deposit (if available)
- After confirming payment, subtract the fee from the amount credited to the user's balance
- Show the user both the gross and net (after-fee) amounts in the invoice detail and/or confirmation message
- Update balance logic to ensure only the net amount is credited

**Manual Testing:**
1. Create a deposit invoice
2. Pay the invoice
3. Confirm that the balance is updated with the net amount (after fee)
4. Confirm that the invoice detail shows both gross and net amounts
5. Test with different deposit amounts and currencies
6. Verify that fee is handled correctly for all supported currencies

---

## Testing Strategy

### Before Each Phase:
1. Ensure previous phase is fully tested and working
2. Create backup of current working state
3. Review requirements for current phase

### During Each Phase:
1. Implement code in small, testable chunks
2. Test each method/function immediately after implementation
3. Verify database changes
4. Test error scenarios

### After Each Phase:
1. Comprehensive manual testing of all new functionality
2. Verify existing functionality still works
3. Test edge cases and error conditions
4. Document any issues found

### Manual Testing Checklist for Each Feature:
- [ ] Happy path testing (normal usage)
- [ ] Input validation testing
- [ ] Error handling testing
- [ ] Database state verification
- [ ] UI/UX flow testing
- [ ] Integration with existing features
- [ ] Performance testing (response times)

## Progress Tracking

### Phase 1: Core Infrastructure
- [x] Step 1.1: Fix UserInvoice Status Mismatch ✅ **COMPLETED**
- [x] Step 1.2: Add Missing Main Menu Buttons ✅ **COMPLETED**
- [ ] Step 1.3: Create UserService

### Phase 2: Transfer Functionality
- [ ] Step 2.1: Create UserTransfer Entity
- [ ] Step 2.2: Add Transfer Methods to XRocketPayService
- [ ] Step 2.3: Create TransferConversation
- [ ] Step 2.4: Add Transfer Handlers and Keyboards

### Phase 3: Multicheque Functionality
- [ ] Step 3.1: Create UserCheque Entity
- [ ] Step 3.2: Add Multicheque Methods to XRocketPayService
- [ ] Step 3.3: Create MultichequeConversation

### Phase 4: External Withdrawal Functionality
- [ ] Step 4.1: Create UserWithdrawal Entity
- [ ] Step 4.2: Add Withdrawal Methods to XRocketPayService
- [ ] Step 4.3: Create ExternalWithdrawalConversation

### Phase 5: History and Status Tracking
- [ ] Step 5.1: Create TransactionService
- [ ] Step 5.2: Implement History Handlers

### Phase 6: Webhook Handling
- [ ] Step 6.1: Create WebhookService
- [ ] Step 6.2: Add Webhook Endpoint

### Phase 7: Final Enhancement
- [ ] Step 7.1: Subtract XRocket Pay Fee After Deposit

## Current Status

**Last completed:** Step 1.2 - Add Missing Main Menu Buttons ✅
**Next step:** Step 1.3 - Create UserService
**Stopping point:** Ready to continue with Step 1.3 when development resumes

**Completed features in Step 1.2:**
- ✅ Added "💸 Withdraw" button to main menu
- ✅ Added "📊 My Withdrawals" button to main menu
- ✅ Added placeholder handlers with "Coming Soon" messages
- ✅ Registered callback handlers in bot
- ✅ Maintained existing functionality

## Notes

- Each step should be implemented and tested before moving to the next
- No more than 200-400 lines of code per step
- Manual testing is required for each step
- Progress will only continue after confirmation that current step is working
- Database migrations should be run after each entity creation
- Error handling should be comprehensive for each feature 