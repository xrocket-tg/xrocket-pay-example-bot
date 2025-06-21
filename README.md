# XRocket Pay Telegram Bot Example

This is a Telegram bot example that demonstrates the usage of xrocket-pay-api-sdk for handling payments.

## Prerequisites

- Node.js (v14 or higher)
- MySQL database
- Telegram Bot Token (get it from [@BotFather](https://t.me/BotFather))

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your configuration:
   ```bash
   cp .env.example .env
   ```
4. Update the `.env` file with your:
   - Telegram Bot Token
   - Database credentials
   - Other configuration values

## Running the Bot

For development:
```bash
npm run dev
```

For production:
```bash
npm run build
npm start
```

## Features

- User registration on first interaction
- Balance tracking for multiple cryptocurrencies (TON, USDT, XROCK)
- Deposit functionality with currency selection
- Simple and intuitive interface

## Development

The bot uses:
- TypeScript
- grammY for Telegram Bot API
- TypeORM for database operations
- xrocket-pay-api-sdk for payment processing 