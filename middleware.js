// middleware.js
import { NextResponse } from 'next/server';

export function middleware(req) {
  // The URL object that NextResponse provides:
  const { pathname } = req.nextUrl;
  const ua = req.headers.get('user-agent') || '';

  // 1) If the user hits "/debug", we rewrite to an API route
  //    so you can see the request headers or do any debugging.
  //    Make sure you have an API route at /api/debug to handle it.
  if (pathname === '/debug') {
    return NextResponse.rewrite(new URL('/api/debug', req.url));
  }

  // 2) Otherwise, do user-agent detection:
  //    e.g., if mobile => rewrite to /mobile, else => /desktop
  //    Adjust your pattern as needed:
  const mobilePattern = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  if (mobilePattern.test(ua)) {
    // Rewrite to your /mobile folder
    return NextResponse.rewrite(new URL(`/mobile${pathname}`, req.url));
  } else {
    // Rewrite to your /desktop folder
    return NextResponse.rewrite(new URL(`/desktop${pathname}`, req.url));
  }
}
