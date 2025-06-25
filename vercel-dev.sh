#!/bin/bash

echo ""
echo "🚀 Starting SettleLah with Vercel Dev..."
echo "⚡ Optimizations: Minified assets, caching, security headers"
echo ""

# Kill any existing processes on common ports
pkill -f "vercel dev" 2>/dev/null || true
pkill -f "node.*index.js" 2>/dev/null || true

# Start Vercel dev and capture the URL
vercel dev --yes --listen 3000 2>&1 | while IFS= read -r line; do
    echo "$line"
    if [[ $line == *"Available at"* ]] || [[ $line == *"Local:"* ]] || [[ $line == *"http://localhost"* ]]; then
        echo ""
        echo "🌐 ==============================================="
        echo "📱 Your SettleLah app is ready!"
        echo "🔗 URL: http://localhost:3000"
        echo "⚡ With Vercel optimizations enabled"
        echo "🌐 ==============================================="
        echo ""
    fi
done