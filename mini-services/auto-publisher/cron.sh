#!/bin/bash
# Auto-Publish Cron Script
# Calls the Next.js auto-publish API endpoint every 60 seconds
# This ensures scheduled posts are published even when no browser is open

INTERVAL=60  # seconds

echo "🤖 Auto-Publish Cron started"
echo "📅 Checking every ${INTERVAL} seconds"
echo "   Time: $(date)"

while true; do
    # Call the auto-publish endpoint for ALL businesses
    response=$(curl -s http://localhost:3000/api/publish/auto?checkAll=true 2>/dev/null)

    if [ $? -eq 0 ]; then
        # Check if any posts were published
        published=$(echo "$response" | grep -o '"publishedCount":[0-9]*' | grep -o '[0-9]*')
        if [ "$published" != "" ] && [ "$published" != "0" ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Published: $response"
        else
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ No due posts"
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ API call failed (server might not be running)"
    fi

    sleep $INTERVAL
done
