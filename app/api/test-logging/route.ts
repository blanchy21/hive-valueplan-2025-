import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();
  
  // Test multiple logging methods
  console.log('\n' + '='.repeat(80));
  console.log(`🧪 TEST LOGGING at ${timestamp}`);
  console.log('='.repeat(80));
  
  process.stdout.write(`STDOUT: Test at ${timestamp}\n`);
  process.stderr.write(`STDERR: Test at ${timestamp}\n`);
  
  return NextResponse.json({
    message: 'Test logging endpoint',
    timestamp,
    check: 'Look at your server console for logs above',
  });
}

