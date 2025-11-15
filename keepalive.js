#!/usr/bin/env node
/**
 * Keepalive Script for Render Free Tier
 * 
 * Render free tier services spin down after 15 minutes of inactivity.
 * This script pings your service every 10 minutes to keep it awake.
 * 
 * Usage:
 *   1. Update YOUR_RENDER_URL below with your actual Render URL
 *   2. Run: node keepalive.js
 *   3. Keep this running during your event
 *   4. Press Ctrl+C to stop
 * 
 * Alternative: Use UptimeRobot.com (free) for automatic monitoring
 */

const YOUR_RENDER_URL = 'https://cc-bidding-project-2025.onrender.com';
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

async function ping() {
  try {
    const startTime = Date.now();
    const response = await fetch(`${YOUR_RENDER_URL}/api/ping`);
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`✅ [${new Date().toISOString()}] Ping successful (${duration}ms): ${data.message}`);
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Ping failed:`, error.message);
  }
}

// Initial ping
console.log('🚀 Keepalive script started');
console.log(`📍 Target: ${YOUR_RENDER_URL}`);
console.log(`⏰ Ping interval: ${PING_INTERVAL_MS / 1000 / 60} minutes`);
console.log('Press Ctrl+C to stop\n');

ping(); // Ping immediately

// Then ping every interval
setInterval(ping, PING_INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Keepalive stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Keepalive stopped');
  process.exit(0);
});

