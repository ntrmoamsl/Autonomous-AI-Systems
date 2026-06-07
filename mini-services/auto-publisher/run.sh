#!/bin/bash
# Auto-Publisher Service Runner
# Runs the auto-publisher as a persistent background service

cd "$(dirname "$0")"

# Load environment variables from .env
export $(grep -v '^#' .env | xargs)

echo "🚀 Starting Auto-Publisher Service..."
echo "   DATABASE_URL: ${DATABASE_URL:0:30}..."
echo "   FB_PAGE_ID: $FB_PAGE_ID"

# Run the service directly (not via 'bun run' which looks for package.json scripts)
exec bun service.ts
