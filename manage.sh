#!/bin/bash

# Helper script for managing the unified nginx setup
# Provides convenient commands for common operations

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}===${NC} $1 ${BLUE}===${NC}"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the github/ root directory"
    exit 1
fi

# Show usage
usage() {
    echo "Dyad Unified Nginx Management Script"
    echo ""
    echo "Usage: ./manage.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start           Start all services"
    echo "  stop            Stop all services"
    echo "  restart         Restart all services"
    echo "  restart-nginx   Restart only nginx"
    echo "  logs            Show logs for all services"
    echo "  logs-nginx      Show nginx logs"
    echo "  logs-backend    Show backend logs"
    echo "  logs-frontend   Show frontend logs"
    echo "  status          Show service status"
    echo "  health          Check health of all services"
    echo "  rebuild         Rebuild and restart all services"
    echo "  test-nginx      Test nginx configuration"
    echo "  ssl-info        Show SSL certificate information"
    echo "  clean           Stop and remove all containers and volumes"
    echo "  help            Show this help message"
    echo ""
}

# Start services
start_services() {
    print_header "Starting all services"
    docker-compose up -d
    print_info "Services started. Use './manage.sh logs' to view logs"
}

# Stop services
stop_services() {
    print_header "Stopping all services"
    docker-compose down
    print_info "Services stopped"
}

# Restart all services
restart_services() {
    print_header "Restarting all services"
    docker-compose restart
    print_info "Services restarted"
}

# Restart nginx only
restart_nginx() {
    print_header "Restarting nginx"
    docker-compose restart nginx
    print_info "Nginx restarted"
}

# Show logs
show_logs() {
    print_header "Showing logs for all services"
    docker-compose logs -f
}

# Show nginx logs
show_nginx_logs() {
    print_header "Showing nginx logs"
    docker-compose logs -f nginx
}

# Show backend logs
show_backend_logs() {
    print_header "Showing backend logs"
    docker-compose logs -f backend
}

# Show frontend logs
show_frontend_logs() {
    print_header "Showing frontend logs"
    docker-compose logs -f frontend
}

# Show service status
show_status() {
    print_header "Service Status"
    docker-compose ps
}

# Check health
check_health() {
    print_header "Checking service health"
    
    echo ""
    print_info "Testing nginx health endpoint..."
    if curl -k -s https://localhost/health | grep -q "ok"; then
        echo -e "  ${GREEN}✓${NC} Nginx: Healthy"
    else
        echo -e "  ${RED}✗${NC} Nginx: Unhealthy"
    fi
    
    print_info "Testing backend directly..."
    if curl -s http://localhost:3001/health | grep -q "ok"; then
        echo -e "  ${GREEN}✓${NC} Backend: Healthy"
    else
        echo -e "  ${RED}✗${NC} Backend: Unhealthy"
    fi
    
    print_info "Testing frontend directly..."
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Frontend: Healthy"
    else
        echo -e "  ${RED}✗${NC} Frontend: Unhealthy"
    fi
    
    echo ""
    print_info "Docker container status:"
    docker-compose ps
}

# Rebuild services
rebuild_services() {
    print_header "Rebuilding all services"
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    print_info "Services rebuilt and started"
}

# Test nginx configuration
test_nginx() {
    print_header "Testing nginx configuration"
    docker-compose exec nginx nginx -t
    if [ $? -eq 0 ]; then
        print_info "Nginx configuration is valid ✓"
    else
        print_error "Nginx configuration has errors"
    fi
}

# Show SSL info
show_ssl_info() {
    print_header "SSL Certificate Information"
    
    if [ -f "ssl/cert.pem" ]; then
        echo ""
        print_info "Certificate details:"
        openssl x509 -in ssl/cert.pem -text -noout | grep -A 2 "Subject:"
        openssl x509 -in ssl/cert.pem -text -noout | grep -A 2 "Validity"
        echo ""
        print_info "Certificate fingerprint:"
        openssl x509 -in ssl/cert.pem -noout -fingerprint
    else
        print_error "No SSL certificate found in ssl/cert.pem"
    fi
}

# Clean everything
clean_all() {
    print_header "Cleaning all containers and volumes"
    print_warning "This will remove all containers, volumes, and networks"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        print_info "All containers and volumes removed"
    else
        print_info "Cancelled"
    fi
}

# Main script logic
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    restart-nginx)
        restart_nginx
        ;;
    logs)
        show_logs
        ;;
    logs-nginx)
        show_nginx_logs
        ;;
    logs-backend)
        show_backend_logs
        ;;
    logs-frontend)
        show_frontend_logs
        ;;
    status)
        show_status
        ;;
    health)
        check_health
        ;;
    rebuild)
        rebuild_services
        ;;
    test-nginx)
        test_nginx
        ;;
    ssl-info)
        show_ssl_info
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        if [ -z "$1" ]; then
            usage
        else
            print_error "Unknown command: $1"
            echo ""
            usage
            exit 1
        fi
        ;;
esac
