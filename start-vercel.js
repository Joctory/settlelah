#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('📱 URL: http://localhost:3000');

// Start Vercel dev
const vercel = spawn('vercel', ['dev', '--yes', '--listen', '3000'], {
  stdio: 'inherit',
  shell: true
});

vercel.on('close', (code) => {
  console.log(`\n🔧 Vercel dev exited with code ${code}`);
});

vercel.on('error', (err) => {
  console.error('❌ Error starting Vercel dev:', err);
});