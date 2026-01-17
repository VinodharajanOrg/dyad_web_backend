#!/bin/bash

# Setup script for unified nginx configuration
# This script helps set up SSL certificates and environment files

set -e

echo "🚀 Dyad Unified Nginx Setup"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the github/ root directory"
    exit 1
fi

# Create directories if they don't exist
print_info "Creating directory structure..."
mkdir -p ssl
mkdir -p logs/nginx
mkdir -p nginx

echo ""
echo "📁 Directory structure created:"
echo "   ✓ ssl/          - SSL certificates"
echo "   ✓ logs/nginx/   - Nginx logs"
echo "   ✓ nginx/        - Nginx configuration"
echo ""

# Check if SSL certificates exist
if [ -f "ssl/cert.pem" ] && [ -f "ssl/key.pem" ]; then
    print_warning "SSL certificates already exist in ssl/"
    read -p "Do you want to regenerate them? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Keeping existing certificates"
    else
        generate_certs=true
    fi
else
    generate_certs=true
fi

if [ "$generate_certs" = true ]; then
    print_info "Checking for existing certificates in project..."
    
    # Check backend SSL
    if [ -f "dyad_web_backend/ssl/cert.pem" ] && [ -f "dyad_web_backend/ssl/key.pem" ]; then
        echo ""
        echo "Found certificates in dyad_web_backend/ssl/"
        read -p "Copy from backend? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            cp dyad_web_backend/ssl/cert.pem ssl/
            cp dyad_web_backend/ssl/key.pem ssl/
            print_info "Copied certificates from backend"
            generate_certs=false
        fi
    fi
    
    # Check frontend SSL if we haven't copied yet
    if [ "$generate_certs" = true ] && [ -f "dyad-web/nginx/ssl/cert.pem" ] && [ -f "dyad-web/nginx/ssl/key.pem" ]; then
        echo ""
        echo "Found certificates in dyad-web/nginx/ssl/"
        read -p "Copy from frontend? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            cp dyad-web/nginx/ssl/cert.pem ssl/
            cp dyad-web/nginx/ssl/key.pem ssl/
            print_info "Copied certificates from frontend"
            generate_certs=false
        fi
    fi
    
    # Generate new certificates if needed
    if [ "$generate_certs" = true ]; then
        print_info "Generating self-signed SSL certificates..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/key.pem -out ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Dyad/CN=localhost" \
            2>/dev/null
        print_info "Self-signed certificates generated successfully"
    fi
fi

echo ""
print_info "SSL certificate setup complete!"
ls -lh ssl/
echo ""

# Check environment files
print_info "Checking environment files..."

# Backend .env
if [ ! -f "dyad_web_backend/.env" ]; then
    if [ -f "dyad_web_backend/env.example" ]; then
        print_warning "Backend .env not found. Creating from env.example..."
        cp dyad_web_backend/env.example dyad_web_backend/.env
        print_warning "Please edit dyad_web_backend/.env with your settings"
    else
        print_error "Backend .env and env.example not found"
    fi
else
    print_info "Backend .env exists"
fi

# Frontend env.local
if [ ! -f "dyad-web/env.local" ]; then
    print_warning "Frontend env.local not found"
    print_info "Creating basic env.local for frontend..."
    cat > dyad-web/env.local << EOF
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://localhost/api
NODE_TLS_REJECT_UNAUTHORIZED=0
EOF
    print_info "Created dyad-web/env.local with basic settings"
else
    print_info "Frontend env.local exists"
fi

echo ""
print_info "Environment files setup complete!"
echo ""

# Note about database configuration
print_warning "Database Configuration Note:"
echo "  This setup does not include PostgreSQL container."
echo "  Make sure to configure DATABASE_URL in dyad_web_backend/.env"
echo "  Examples:"
echo "    - Host database: postgresql://user:pass@host.docker.internal:5432/dyad"
echo "    - Remote database: postgresql://user:pass@remote-host:5432/dyad"
echo ""

# Test nginx configuration if nginx is installed locally
if command -v nginx &> /dev/null; then
    print_info "Testing nginx configuration syntax..."
    if docker run --rm -v "$(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t 2>&1 | grep -q "successful"; then
        print_info "Nginx configuration syntax is valid ✓"
    else
        print_warning "Nginx configuration test failed"
    fi
    echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review and update environment files:"
echo "     - dyad_web_backend/.env"
echo "     - dyad-web/env.local"
echo ""
echo "  2. Start all services:"
echo "     docker-compose up -d"
echo ""
echo "  3. Access the application:"
echo "     Frontend:  https://localhost"
echo "     Backend:   https://localhost/api"
echo "     API Docs:  https://localhost/api-docs"
echo "     Health:    https://localhost/health"
echo ""
echo "  4. View logs:"
echo "     docker-compose logs -f"
echo ""
print_info "For more information, see README.md"
