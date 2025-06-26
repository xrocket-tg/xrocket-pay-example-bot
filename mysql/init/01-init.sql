-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS xrocket_bot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE xrocket_bot_db;

-- Create user if it doesn't exist (this will be handled by environment variables)
-- The actual user creation is handled by MySQL environment variables in docker-compose.yml 