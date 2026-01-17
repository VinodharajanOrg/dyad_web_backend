#!/bin/bash

# Script to validate the HTTPS setup before starting services
# This checks that all required files exist and configurations are valid

set -e

echo "🔍 Validating HTTPS Setup..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if nginx directory exists
if [ ! -d "nginx" ]; then
    echo -e "${RED}❌ nginx directory not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ nginx directory exists${NC}"

# Check nginx configuration file
if [ ! -f "nginx/nginx.conf" ]; then
    echo -e "${RED}❌ nginx/nginx.conf not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ nginx/nginx.conf exists${NC}"

# Check nginx Dockerfile
if [ ! -f "nginx/Dockerfile" ]; then
    echo -e "${RED}❌ nginx/Dockerfile not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ nginx/Dockerfile exists${NC}"

# Check SSL directory
if [ ! -d "nginx/ssl" ]; then
    echo -e "${RED}❌ nginx/ssl directory not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ nginx/ssl directory exists${NC}"

# Check for SSL certificates
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    echo -e "${YELLOW}⚠️  SSL certificates not found${NC}"
    echo "   Run: ./scripts/generate-ssl-certs.sh to generate self-signed certificates"
else
    echo -e "${GREEN}✓ SSL certificates exist${NC}"
    
    # Check certificate validity
    if command -v openssl &> /dev/null; then
        CERT_EXPIRY=$(openssl x509 -enddate -noout -in nginx/ssl/cert.pem 2>/dev/null | cut -d= -f2)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}  Certificate expires: $CERT_EXPIRY${NC}"
        fi
    fi
fi

# Check docker-compose.yml
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ docker-compose.yml exists${NC}"

# Validate docker-compose syntax
if command -v docker-compose &> /dev/null || command -v docker &> /dev/null; then
    if docker compose config > /dev/null 2>&1 || docker-compose config > /dev/null 2>&1; then
        echo -e "${GREEN}✓ docker-compose.yml syntax is valid${NC}"
    else
        echo -e "${RED}❌ docker-compose.yml syntax is invalid${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Docker not found, skipping docker-compose validation${NC}"
fi

# Check if ports 80 and 443 are available
if command -v lsof &> /dev/null; then
    if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port 80 is already in use${NC}"
    else
        echo -e "${GREEN}✓ Port 80 is available${NC}"
    fi
    
    if lsof -Pi :443 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port 443 is already in use${NC}"
    else
        echo -e "${GREEN}✓ Port 443 is available${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ Validation complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Generate SSL certificates (if not already done):"
echo "     ./scripts/generate-ssl-certs.sh"
echo ""
echo "  2. Start services:"
echo "     docker-compose up -d nginx"
echo ""
echo "  3. Access application:"
echo "     https://10.157.139.104"
echo "     (or https://localhost if accessing from the same machine)"
