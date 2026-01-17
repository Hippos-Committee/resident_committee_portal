#!/bin/bash

# Webhook Testing Script
# Exposes local dev server via ngrok for Resend webhook testing

PORT=${1:-5173}
WEBHOOK_PATH="/api/webhooks/resend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Webhook Testing Setup${NC}"
echo "=========================="

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}ngrok not found. Installing via Homebrew...${NC}"
    brew install ngrok
fi

# Check if dev server is running
if ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Dev server not detected on port $PORT${NC}"
    echo "   Make sure 'bun dev' is running in another terminal"
    echo ""
fi

echo -e "${GREEN}Starting ngrok on port $PORT...${NC}"
echo ""

# Start ngrok and capture output
ngrok http $PORT &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get the public URL from ngrok API
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$NGROK_URL" ]; then
    WEBHOOK_URL="${NGROK_URL}${WEBHOOK_PATH}"
    
    echo -e "${GREEN}✅ ngrok is running!${NC}"
    echo ""
    echo "=========================================="
    echo -e "${YELLOW}Webhook URL for Resend:${NC}"
    echo -e "${GREEN}$WEBHOOK_URL${NC}"
    echo "=========================================="
    echo ""
    echo "📋 Next steps:"
    echo "1. Go to Resend Dashboard → Webhooks"
    echo "2. Add/Update webhook with URL above"
    echo "3. Select event: email.received"
    echo "4. Click 'Send Test' to verify"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    
    # Copy to clipboard if pbcopy available (macOS)
    if command -v pbcopy &> /dev/null; then
        echo "$WEBHOOK_URL" | pbcopy
        echo -e "${GREEN}📋 URL copied to clipboard!${NC}"
    fi
    
    # Wait for ngrok process
    wait $NGROK_PID
else
    echo -e "${RED}❌ Failed to get ngrok URL. Check if ngrok started correctly.${NC}"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi
