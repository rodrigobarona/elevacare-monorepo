import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'eleva-api',
    zone: '/api',
    timestamp: new Date().toISOString(),
  });
}
