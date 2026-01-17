#!/bin/bash

# Script to generate self-signed SSL certificates for development
# For production, use Let's Encrypt or your own certificates

CERT_DIR="./nginx/ssl"
DAYS_VALID=365
SERVER_IP="10.157.139.104"

echo "Generating self-signed SSL certificates for $SERVER_IP..."

# Create directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Create OpenSSL configuration for IP SAN
cat > "$CERT_DIR/openssl.cnf" <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Organization
CN = $SERVER_IP

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
IP.1 = $SERVER_IP
DNS.1 = localhost
EOF

# Generate private key and certificate with IP SAN
openssl req -x509 -nodes -days $DAYS_VALID -newkey rsa:2048 \
    -keyout "$CERT_DIR/key.pem" \
    -out "$CERT_DIR/cert.pem" \
    -config "$CERT_DIR/openssl.cnf" \
    -extensions v3_req

# Clean up temporary config file
rm -f "$CERT_DIR/openssl.cnf"

echo "SSL certificates generated successfully!"
echo "Location: $CERT_DIR"
echo "Server IP: $SERVER_IP"
echo ""
echo "⚠️  WARNING: These are self-signed certificates for development only!"
echo "For production, use Let's Encrypt or a trusted Certificate Authority."
echo ""
echo "To trust this certificate, you may need to add it to your system's trust store."
