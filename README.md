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

## Production Readiness

Before deploying this bot to a production environment, consider the following important recommendations:

### 1. Use Webhooks Instead of Long Polling

**Current State**: This demo bot uses long polling for receiving Telegram updates, which is suitable for development and testing.

**Production Recommendation**: Switch to webhooks for better performance and reliability:

```typescript
// In src/index.ts, replace the polling setup with webhook
bot.api.setWebhook(`${WEBHOOK_URL}/telegram`, {
  allowed_updates: ["message", "callback_query"],
  secret_token: WEBHOOK_SECRET
});

// Add webhook endpoint
app.post('/telegram', async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    logger.error('Webhook error:', error);
    res.sendStatus(500);
  }
});
```

**Benefits of Webhooks**:
- **Real-time updates**: Instant message processing
- **Better performance**: No constant polling overhead
- **Resource efficiency**: Reduced server load
- **Scalability**: Better for high-traffic bots
- **Reliability**: More stable connection handling

**Setup Requirements**:
- Public HTTPS endpoint for webhook URL
- Proper SSL certificate
- Webhook secret for security
- Load balancer configuration for high availability

### 2. Implement Proper Database Migrations

**Current State**: The demo uses `synchronize: true` in TypeORM configuration, which automatically creates/updates database schema.

**Production Recommendation**: Use a proper migration strategy:

```typescript
// In src/config/database.ts, disable synchronize
export const AppDataSource = new DataSource({
  // ... other config
  synchronize: false, // Disable in production
  migrations: ["src/migrations/*.ts"],
  migrationsRun: true,
});
```

**Migration Strategy**:

1. **Generate migrations**:
```bash
npm run typeorm migration:generate -- -n InitialSchema
```

2. **Run migrations**:
```bash
npm run typeorm migration:run
```

3. **Revert migrations** (if needed):
```bash
npm run typeorm migration:revert
```

**Benefits of Migrations**:
- **Version control**: Track database schema changes
- **Rollback capability**: Safely revert schema changes
- **Team collaboration**: Consistent database state across environments
- **Production safety**: No automatic schema modifications
- **Audit trail**: Document all database changes

**Migration Best Practices**:
- Always test migrations on staging first
- Use descriptive migration names
- Include both up and down migrations
- Backup database before running migrations
- Run migrations during maintenance windows
- Monitor migration execution in production

### 3. Implement Proper Session Storage

**Current State**: This demo bot uses in-memory session storage, which is suitable for development and single-instance deployments.

**Production Recommendation**: Use persistent session storage for scalability and reliability:

```typescript
// Install required packages
// npm install @grammyjs/storage-redis
// npm install @grammyjs/storage-mongodb
// npm install @grammyjs/storage-postgres

// For Redis storage
import { RedisAdapter } from "@grammyjs/storage-redis";
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0"),
});

const sessionStorage = new RedisAdapter({
  instance: redis,
  ttl: 60 * 60 * 24 * 7, // 7 days
});

// For MongoDB storage
import { MongoAdapter } from "@grammyjs/storage-mongodb";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017");
const collection = client.db("bot").collection("sessions");

const sessionStorage = new MongoAdapter({
  collection,
  ttl: 60 * 60 * 24 * 7, // 7 days
});

// Apply session storage to bot
bot.use(session({
  initial: () => ({ step: undefined }),
  storage: sessionStorage,
}));
```

**Benefits of Persistent Session Storage**:
- **Scalability**: Support multiple bot instances
- **Reliability**: Sessions survive server restarts
- **Load Balancing**: Sessions shared across instances
- **Data Persistence**: No session loss during deployments
- **Monitoring**: Track session usage and patterns

**Storage Options**:

1. **Redis** (Recommended):
   - Fast in-memory storage with persistence
   - Built-in TTL support
   - Excellent for high-traffic bots
   - Easy clustering and replication

2. **MongoDB**:
   - Document-based storage
   - Good for complex session data
   - Built-in indexing and querying
   - Flexible schema

3. **PostgreSQL**:
   - ACID compliance
   - Good for relational session data
   - Built-in backup and recovery
   - Familiar SQL interface

**Session Configuration Best Practices**:
- Set appropriate TTL (Time To Live) for sessions
- Implement session cleanup strategies
- Monitor session storage performance
- Use connection pooling for database storage
- Implement session encryption for sensitive data
- Regular backup of session data

### 4. Additional Production Considerations

**Environment Configuration**:
- Use environment-specific configuration files
- Implement proper secrets management
- Use production-grade database (consider managed services)
- Configure proper logging levels and rotation

**Monitoring and Alerting**:
- Implement health checks for all services
- Set up monitoring for database performance
- Configure alerting for critical errors
- Monitor webhook delivery and processing

**Security Enhancements**:
- Implement rate limiting for webhook endpoints
- Use proper authentication for admin endpoints
- Configure firewall rules appropriately
- Regular security updates and dependency scanning

**Performance Optimization**:
- Implement caching strategies
- Optimize database queries
- Use connection pooling
- Consider horizontal scaling for high traffic

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. 