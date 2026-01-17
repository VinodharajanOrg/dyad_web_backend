#!/bin/bash

# Script to generate self-signed SSL certificate for development
# This creates a certificate valid for localhost and local IP addresses

echo "🔐 Generating self-signed SSL certificate for HTTPS..."

# Create ssl directory if it doesn't exist
mkdir -p ssl

# Get local IP address (works on macOS and Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
else
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

echo "📍 Detected local IP: $LOCAL_IP"

# Create OpenSSL config with SANs (Subject Alternative Names)
cat > ssl/openssl.cnf << EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = Development
L = Development
O = Development
OU = Development
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
IP.3 = $LOCAL_IP
EOF

# Generate private key and certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -config ssl/openssl.cnf

# Set proper permissions
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem

echo "✅ SSL certificate generated successfully!"
echo ""
echo "📁 Files created:"
echo "   - ssl/key.pem  (private key)"
echo "   - ssl/cert.pem (certificate)"
echo ""
echo "⚠️  This is a self-signed certificate for development only!"
echo "   Browsers will show a security warning - you'll need to accept it."
echo ""
echo "🚀 You can now start your server with HTTPS:"
echo "   USE_HTTPS=true npm run dev"
echo ""
echo "🌐 Access your server at:"
echo "   - https://localhost:3001"
echo "   - https://$LOCAL_IP:3001"
