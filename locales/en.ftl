main-welcome = 
    🤖 <b>Demo Bot Information</b>

    This is a demo-bot to demonstrate abilities of xRocket Pay: payment API from @xRocket bot

    📚 <b>Resources:</b>
    • Source code: <a href="https://github.com/xrocket-tg/xrocket-pay-example-bot">GitHub Repository</a>
    • TypeScript SDK: <a href="https://www.npmjs.com/package/xrocket-pay-api-sdk">npm Package</a>
    • API Documentation: <a href="https://pay.xrocket.tg/api#/">Swagger UI</a>
    • API Schema: <a href="https://pay.xrocket.tg/api-json">OpenAPI JSON</a>

    ⚠️ <b>Warning:</b> This bot is created for testing purposes. If you want to reuse this code for production, please do it on your own risk.

    🐛 <b>Support:</b>
    • Report issues: <a href="https://github.com/xrocket-tg/xrocket-pay-example-bot/issues">GitHub Issues</a>
    • Join chat: <a href="https://t.me/+mA9IoHSdvIRhZjFi">Telegram Community</a>

    ----------------------

main-menu = Main Menu

language-select = 
    🌐 Please select your language:
    Пожалуйста, выберите язык:
language-changed = Language changed successfully!

balance-title = 💰 Your balance:
balance-no-balance = No balances yet
balance-currency-format = { $emoji } { $name }: { $amount }

deposit-select-currency = 
    💱 Select currency for deposit:

    💡 <i>Note: If you have products with known prices, you can skip this step and offer users your products directly with pricing, then proceed to creating an invoice.</i>

deposit-enter-amount = 
    💵 Enter amount to deposit in { $emoji } { $name }:

    💡 <i>Note: If you have products with known prices, you can skip this step and offer users your products directly with pricing, then proceed to creating an invoice.</i>
deposit-creating-invoice = ⏳ Creating invoice...
deposit-invoice-created = 
    💳 Invoice created successfully!

    💰 Amount: { $amount } { $emoji } { $name }
    🆔 Invoice ID: { $invoiceId }
    📅 Created: { $createdAt }

    💳 Pay this invoice to add funds to your balance.

deposit-payment-info = 
    💡 Payment handling:
    • Click 'Check Payment' to manually check if invoice is paid
    • Or wait for automatic webhook processing
    • Payment status will update automatically

withdrawal-select-type = 
    💸 <b>Choose Withdrawal Option</b>

    🚀 <b>xRocket bot has 3 ways to send payments to your users:</b>

    💬 <b>1. Transfers</b>
    Best if you know telegram ID and user is already in @xRocket. They will receive payment and message right in bot. If you send too small amount, name of app will be changed to "Some App". This was done to prevent spam.

    🎫 <b>2. Cheques</b>
    If you are not sure if user ever started xRocket, you can deliver them crypto using cheques. User will need to click by cheque link to activate it. There is also bonus, if you catch new users this way, they will become your refferals in @xRocket.

    🌐 <b>3. Direct Blockchain</b>
    If you know only blockchain address of user, you can send them crypto directly. In this case, flat blockchain fee applies (same as when you withdraw from @xRocket).

withdrawal-transfer-description = 🔄 Transfer to another user via Telegram ID
withdrawal-multicheque-description = 🎫 Create a cheque
withdrawal-external-description = 🌐 Withdraw to external wallet address
withdrawal-select-currency = 💱 Select currency for withdrawal:
withdrawal-select-network = 🌐 Select network for { $currency }:
withdrawal-currency-selection = 💸 Choose currency to withdraw:
withdrawal-network-selection = 🌐 Choose network for { $emoji } { $name }:
withdrawal-amount-info = 
    💸 Withdrawal amount: { $amount } { $emoji } { $name }
    💸 Fee: { $fee } { $emoji } { $name }
    💰 Total amount: { $totalRequired } { $emoji } { $name }

    🔗 Enter the external wallet address for { $network }:

withdrawal-balance-info = 
    💵 Enter amount to withdraw:

    💰 Your { $emoji } { $name } balance: { $balance }
    💸 Withdrawal fee ({ $network }): { $fee } { $name }
    📊 Maximum withdrawal: { $maxWithdrawal } { $name }

withdrawal-confirmation = 
    ⚠️ Please confirm your withdrawal:

    💰 Amount: { $amount } { $currency }
    💸 Fee: { $fee } { $currency }
    💰 Total: { $total } { $currency }
    🌐 Network: { $network }
    🔗 Address: { $address }

    Do you want to proceed?

withdrawal-confirm-button = ✅ Confirm Withdrawal
withdrawal-cancel-button = ❌ Cancel

withdrawal-withdrawal-details = 
    🌐 Withdrawal Details

    💰 Amount: { $amount } { $emoji } { $name }
    💸 Fee: { $fee } { $emoji } { $name }
    💰 Total: { $totalAmount } { $emoji } { $name }
    🌐 Network: { $network }
    🔗 Address: { $address }
    📊 Status: { $statusEmoji } { $status }
    🆔 Withdrawal ID: { $withdrawalId }
    📅 Created: { $createdAt }

transfer-select-currency = 💱 Select currency for transfer:
transfer-enter-amount = 💵 Enter amount to transfer in { $emoji } { $name }:
transfer-enter-recipient = 
    👤 Enter recipient's Telegram ID:

Your Telegram ID: <code>{ $userId }</code> (tap to copy)

Amount: { $amount } { $emoji } { $name }

transfer-confirm-transfer = 
    📋 Transfer Confirmation

    💰 Amount: { $amount } { $emoji } { $name }
    👤 Recipient ID: { $recipientId }

    Please confirm the transfer:

transfer-transfer-success = 
    ✅ Transfer completed successfully!

    💰 Amount: { $amount } { $emoji } { $name }
    👤 Recipient ID: { $recipientId }
    🆔 Transfer ID: { $transferId }

multicheque-select-currency = 💱 Select currency for cheque:
multicheque-enter-amount = 💵 Enter amount for cheque in { $emoji } { $name }:
multicheque-confirm-multicheque = 
    🎫 Cheque Confirmation

    💰 Amount: { $amount } { $emoji } { $name }

    Please confirm the cheque creation:

multicheque-multicheque-success = 
    ✅ Cheque created successfully!

    💰 Amount: { $amount } { $emoji } { $name }
    🆔 Cheque ID: { $chequeId }

invoices-title = 📋 Your invoices:

invoices-no-invoices = No invoices yet
invoices-invoice-item = 
    💰 { $amount } { $emoji } { $name } - { $status }
    🆔 { $invoiceId }
    📅 { $createdAt }

invoices-invoice-detail = 
    💳 Invoice Details

    💰 Amount: { $amount } { $emoji } { $name }
    �� Status: { $statusEmoji } { $status }
    🆔 Invoice ID: { $invoiceId }
    📅 Created: { $createdAt }

    { $paymentInfo }

invoices-payment-info = 
    💡 Payment handling:
    • Click 'Check Payment' to manually check if invoice is paid
    • Or wait for automatic webhook processing
    • Payment status will update automatically

withdrawals-select-type = 📋 Select withdrawal history type:
withdrawals-transfers-title = 🔄 Your transfers:

withdrawals-cheques-title = 🎫 Your cheques:

withdrawals-external-title = 🌐 Your external withdrawals:

withdrawals-no-transfers = No transfers yet
withdrawals-no-cheques = No cheques yet
withdrawals-no-external = No external withdrawals yet
withdrawals-transfer-item = 
    💰 { $amount } { $emoji } { $name } → { $recipientId }
    🆔 { $transferId }
    📅 { $createdAt }

withdrawals-cheque-item = 
    💰 { $amount } { $emoji } { $name }
    🆔 { $chequeId }
    📅 { $createdAt }

withdrawals-external-item = 
    💰 { $amount } { $emoji } { $name } → { $address }
    🆔 { $withdrawalId }
    📅 { $createdAt }

errors-invalid-amount = Invalid amount. Please try again.
errors-invalid-currency = Invalid currency selected
errors-invalid-telegram-id = Invalid Telegram ID. Please enter a valid number.
errors-invalid-address = Invalid address format. Please check the address and try again.
errors-insufficient-balance = ❌ Insufficient balance. You have { $available } { $name }, but trying to use { $required } { $name }.
errors-session-missing = Session data missing. Please start over.
errors-no-currency-selected = No currency selected. Please start over.
errors-invalid-context = Invalid context for { $action }
errors-service-unavailable = Service temporarily unavailable. Please try again later.
errors-invalid-request = Invalid request. Please check your input and try again.
errors-authentication-failed = Authentication failed. Please try again later.
errors-access-denied = Access denied. Please try again later.
errors-server-error = Server error. Please try again later.
errors-too-many-requests = Too many requests. Please wait a moment and try again.
errors-network-error = Network error. Please check your connection and try again.
errors-database-error = Database error. Please try again later.
errors-session-expired = Session expired. Please start over.
errors-unexpected-error = An unexpected error occurred. Please try again.

buttons-confirm = ✅ Confirm
buttons-cancel = ❌ Cancel
buttons-back = ⬅️ Back
buttons-next = ➡️ Next
buttons-check-payment = 💳 Check Payment
buttons-pay-invoice = 💳 Pay Invoice
buttons-main-menu = 🏠 Main Menu
buttons-balance = 💰 Balance
buttons-deposit = 💳 Deposit
buttons-withdraw = 💸 Withdraw
buttons-transfer = 🔄 Transfer
buttons-multicheque = 🎫 Cheque
buttons-invoices = 📋 My Invoices
buttons-withdrawals = 📊 My Withdrawals
buttons-transfers = 🔄 My Transfers
buttons-cheques = 🎫 My Cheques
buttons-external = 🌐 My Blockchain
buttons-confirm-transfer = ✅ Confirm Transfer
buttons-confirm-withdrawal = ✅ Confirm
buttons-confirm-multicheque = ✅ Confirm Cheque
buttons-blockchain-transfer = 🌐 Blockchain Transfer

status-pending = ⏳ Pending
status-paid = ✅ Paid
status-completed = ✅ Completed
status-failed = ❌ Failed
status-created = ⏳ Created

# Cheque-related keys
cheques-open-cheque = 🎫 Open Cheque
cheques-back-to-list = 📋 Back to Cheques
cheques-title = 🎫 My Cheques
cheques-select-to-view = Select a cheque to view details:
cheques-no-cheques = No cheques found.
cheques-details-title = 🎫 Cheque Details
cheques-amount = 💰 Amount:
cheques-users = 👥 Users:
cheques-status = 📊 Status:
cheques-cheque-id = 🆔 Cheque ID:
cheques-created = 📅 Created:

# Withdrawal-related keys
withdrawals-back-to-list = ⬅️ Back to Withdrawals
withdrawals-blockchain-title = 🌐 My Blockchain Withdrawals
withdrawals-select-to-view = Select a withdrawal to view details:
withdrawals-no-withdrawals = No withdrawals found.
withdrawals-details-title = 🌐 Withdrawal Details
withdrawals-amount = 💰 Amount:
withdrawals-fee = 💸 Fee:
withdrawals-total = 💰 Total:
withdrawals-network = 🌐 Network:
withdrawals-address = 🔗 Address:
withdrawals-status = 📊 Status:
withdrawals-withdrawal-id = 🆔 Withdrawal ID:
withdrawals-created = 📅 Created:
withdrawals-tx-hash = 🔗 Transaction Hash:
withdrawals-error = ❌ Error:
withdrawals-comment = 💬 Comment:
withdrawals-check-status = 🔄 Check Status
withdrawals-view-transaction = 🔗 View Transaction
withdrawals-back-to-withdrawals = 📊 Back to Withdrawals

# Common words
total = total 

withdrawal-amount-info = 
    💸 Withdrawal amount: { $amount } { $emoji } { $name }
    💸 Fee: { $fee } { $emoji } { $name }
    💰 Total amount: { $totalRequired } { $emoji } { $name }

    🔗 Enter the external wallet address for { $network }: 