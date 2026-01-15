# PowerShell script to generate self-signed SSL certificate for Windows

Write-Host "🔐 Generating self-signed SSL certificate for HTTPS..." -ForegroundColor Cyan

# Create ssl directory if it doesn't exist
if (-not (Test-Path "ssl")) {
    New-Item -ItemType Directory -Path "ssl" | Out-Null
}

# Get local IP address
$LOCAL_IP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet*", "Wi-Fi*" | Select-Object -First 1).IPAddress

Write-Host "📍 Detected local IP: $LOCAL_IP" -ForegroundColor Green

# Create OpenSSL config
$opensslConfig = @"
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
"@

$opensslConfig | Out-File -FilePath "ssl\openssl.cnf" -Encoding ASCII

# Generate certificate using OpenSSL (requires OpenSSL to be installed)
& openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout ssl\key.pem `
    -out ssl\cert.pem `
    -config ssl\openssl.cnf

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ SSL certificate generated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📁 Files created:" -ForegroundColor Cyan
    Write-Host "   - ssl\key.pem  (private key)"
    Write-Host "   - ssl\cert.pem (certificate)"
    Write-Host ""
    Write-Host "⚠️  This is a self-signed certificate for development only!" -ForegroundColor Yellow
    Write-Host "   Browsers will show a security warning - you'll need to accept it."
    Write-Host ""
    Write-Host "🚀 You can now start your server with HTTPS:" -ForegroundColor Cyan
    Write-Host "   npm run dev"
    Write-Host ""
    Write-Host "🌐 Access your server at:" -ForegroundColor Cyan
    Write-Host "   - https://localhost:3001"
    Write-Host "   - https://$LOCAL_IP:3001"
} else {
    Write-Host "❌ Error generating certificate. Make sure OpenSSL is installed." -ForegroundColor Red
    Write-Host "   Download from: https://slproweb.com/products/Win32OpenSSL.html"
}
