#!/bin/bash
# Script to help find backend URL

echo "=== Backend URL Finder ==="
echo ""

# Check if backend is running on common ports
echo "1. Testing common backend URLs:"
echo "   http://65.1.126.85:3000"
curl -s -o /dev/null -w "   Status: %{http_code}\n" http://65.1.126.85:3000/api || echo "   ❌ Not accessible"

echo ""
echo "2. Checking for running Node.js processes:"
ps aux | grep node | grep -v grep || echo "   No Node.js processes found"

echo ""
echo "3. Checking Docker containers:"
docker ps | grep backend || echo "   No backend container found"

echo ""
echo "4. Checking open ports:"
netstat -tulpn 2>/dev/null | grep :3000 || ss -tulpn 2>/dev/null | grep :3000 || echo "   Port 3000 not found in listening ports"

echo ""
echo "=== Recommendation ==="
echo "Most likely backend URL: http://65.1.126.85:3000"
echo "Set this in frontend/index.html:"
echo "  window.__API_BASE_URL__ = 'http://65.1.126.85:3000';"

