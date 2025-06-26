#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please create it with your configuration."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version > /dev/null 2>&1; then
    print_error "Docker Compose is not available. Please install Docker Compose v2."
    exit 1
fi

print_status "Starting deployment..."

# Stop existing containers
print_status "Stopping existing containers..."
docker compose down

# Remove old images
print_status "Removing old images..."
docker compose down --rmi all

# Build and start services
print_status "Building and starting services..."
docker compose up -d --build

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 30

# Check service status
print_status "Checking service status..."
docker compose ps

# Check logs
print_status "Recent logs:"
docker compose logs --tail=20

print_status "Deployment completed!"
print_status "You can check the logs with: docker compose logs -f"
print_status "To stop the services: docker compose down" 