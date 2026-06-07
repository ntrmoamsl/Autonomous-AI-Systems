/**
 * Entry point for Auto-Publisher Service
 * Loads .env variables FIRST, then starts the service via dynamic import.
 * This is necessary because ES module imports are hoisted and would
 * execute before runtime .env loading code.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env file and set environment variables BEFORE any other imports
try {
  const envPath = resolve(__dirname, '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      // Force override - Bun auto-loads .env from parent dirs which may have wrong values
      process.env[key] = value;
    }
  }
  console.log('✅ Environment variables loaded from .env');
} catch (err) {
  console.error('⚠️ Could not load .env file:', err);
  process.exit(1);
}

// Now dynamically import the service (PrismaClient will have access to env vars)
// Use top-level await to keep process alive
await import('./service.ts');
