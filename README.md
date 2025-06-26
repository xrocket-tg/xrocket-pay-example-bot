# xRocket Pay Telegram Bot

A comprehensive Telegram bot for handling cryptocurrency payments using the xRocket Pay API. Features include deposit, withdrawal, and transfer functionality with full transaction management.

## Features

- **Deposit System**: Create invoices and track payments via xRocket Pay
- **Withdrawal Options**: 
  - Transfer to other users
  - Multicheque creation
  - External wallet withdrawals
- **Transaction Management**: All balance operations wrapped in transactions
- **Webhook Support**: Real-time payment notifications
- **History Tracking**: Complete transaction history for all operations
- **Error Handling**: Comprehensive error logging and handling
- **Currency Support**: Full support for multiple cryptocurrencies with proper mapping

## Tech Stack

- **Backend**: TypeScript, Node.js, Express
- **Database**: MySQL with TypeORM
- **Telegram Bot**: Grammy.js
- **Payment API**: xRocket Pay SDK
- **Deployment**: Docker Compose, Nginx, Cloudflare

## Prerequisites

- Node.js 18+
- Docker and Docker Compose v2
- MySQL 8.0+
- Telegram Bot Token
- xRocket Pay API credentials

## Environment Variables

Create a `.env` file with the following variables:

```env
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token

# xRocket Pay Configuration
XROCKET_PAY_API_KEY=your_api_key
XROCKET_PAY_SECRET_KEY=your_secret_key
XROCKET_PAY_BASE_URL=https://api.xrocket-pay.com

# Webhook Configuration
WEBHOOK_URL=/webhook
WEBHOOK_SECRET=your_webhook_secret

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=xrocket_bot
DB_PASSWORD=your_db_password
DB_DATABASE=xrocket_bot_db
MYSQL_ROOT_PASSWORD=your_root_password

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up the database:
```bash
npm run db:setup
```

3. Start the development server:
```bash
npm run dev
```

## Docker Deployment

### Quick Start

1. Clone the repository and navigate to the project directory
2. Create your `.env` file with proper configuration
3. Run the deployment script:

```bash
./deploy.sh
```

### Manual Deployment

1. Build and start services:
```bash
docker compose up -d --build
```

2. Check service status:
```bash
docker compose ps
```

3. View logs:
```bash
docker compose logs -f
```

### Docker Compose Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f app
docker compose logs -f mysql
docker compose logs -f nginx

# Restart services
docker compose restart

# Rebuild and start
docker compose up -d --build
```

## Cloudflare Setup

1. **Add your domain to Cloudflare**
2. **Configure DNS records**:
   - Add an A record pointing to your server's IP address
   - Set the proxy status to "Proxied" (orange cloud)
3. **Configure SSL/TLS**:
   - Set SSL/TLS encryption mode to "Flexible"
   - Enable "Always Use HTTPS"
4. **Configure Page Rules** (optional):
   - Add rules for caching and security headers

### Cloudflare Configuration

The Nginx configuration is optimized for Cloudflare with:
- Proper IP forwarding headers
- Rate limiting
- Security headers
- Gzip compression
- Health check endpoints

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /webhook` - xRocket Pay webhook endpoint
- `GET /` - Main application endpoint

## Database Schema

The application uses the following entities:
- `User` - Telegram user information
- `UserBalance` - User balances for different currencies
- `UserInvoice` - Deposit invoices
- `UserTransfer` - User-to-user transfers
- `UserCheque` - Multicheque records
- `UserWithdrawal` - External withdrawal records

## Monitoring and Logs

- Application logs are stored in `./logs/`
- Database logs are available via `docker compose logs mysql`
- Nginx logs are available via `docker compose logs nginx`

## Security Features

- Rate limiting on API endpoints
- Input validation and sanitization
- SQL injection protection via TypeORM
- XSS protection headers
- CSRF protection
- Secure session management
- Resource limits and health checks
- MySQL not exposed externally

## Troubleshooting

### Common Issues

1. **Database connection failed**:
   - Check if MySQL container is running: `docker compose ps`
   - Verify environment variables in `.env`
   - Check MySQL logs: `docker compose logs mysql`

2. **Bot not responding**:
   - Verify `BOT_TOKEN` in `.env`
   - Check bot logs: `docker compose logs app`
   - Ensure webhook URL is accessible

3. **Webhook not working**:
   - Verify `WEBHOOK_SECRET` matches xRocket Pay configuration
   - Check if webhook URL is publicly accessible
   - Review webhook logs in application

4. **Docker Compose not found**:
   - Ensure you have Docker Compose v2 installed
   - Use `docker compose` (without hyphen) instead of `docker-compose`

### Logs and Debugging

```bash
# View all logs
docker compose logs

# View specific service logs
docker compose logs app
docker compose logs mysql
docker compose logs nginx

# Follow logs in real-time
docker compose logs -f

# Check container status
docker compose ps

# Check resource usage
docker stats
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. 