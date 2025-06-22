import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/register', '/reset-password', '/verify-email', '/']
  
  // Get tokens from cookies
  const token = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value
  
  console.log('Middleware - Path:', pathname, 'Token exists:', !!token, 'Refresh exists:', !!refreshToken)
  
  // If trying to access protected route without any token
  if (!token && !refreshToken && !isPublicRoute(pathname)) {
    console.log('Redirecting to login - no tokens')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // // If authenticated and trying to access auth pages (but not home), redirect to home
  // if (token && ['/login', '/register'].includes(pathname)) {
  //   console.log('Redirecting to home - has token')
  //   return NextResponse.redirect(new URL('/', request.url))
  // }

  return NextResponse.next()
}

function isPublicRoute(pathname: string): boolean {
  const publicRoutes = ['/login', '/register', '/reset-password', '/verify-email', '/']
  const publicPrefixes = ['/api/', '/_next/', '/favicon.ico']
  
  return publicRoutes.includes(pathname) || 
         publicPrefixes.some(prefix => pathname.startsWith(prefix)) ||
         pathname.includes('.')
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',  ],
}
