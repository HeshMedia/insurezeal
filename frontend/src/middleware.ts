import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = (pathname: string): boolean => {
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/reset-password',
    '/verify-email',
    '/verify-email/success',
    '/forgot-password'
  ]
  
  return publicRoutes.includes(pathname) || 
         pathname.startsWith('/api/') ||
         pathname.startsWith('/_next/') ||
         pathname.startsWith('/favicon.ico') ||
         pathname.includes('.')
}

// Helper to decode JWT role safely
const getJWTRole = (token: string): string | null => {
  try {
    const base64Payload = token.split('.')[1]
    const payload = JSON.parse(atob(base64Payload))
    
    // Try to get role from user_metadata first (new format)
    if (payload?.user_metadata?.role) {
      return payload.user_metadata.role
    }
    
    // Fallback to top-level role or other locations
    return payload?.role || null
  } catch (error) {
    console.error('Middleware - Error decoding JWT:', error)
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log('Middleware - Processing path:', pathname)
  
  // Handle Supabase email verification redirect
  if (pathname === '/' && request.nextUrl.searchParams.has('token') && request.nextUrl.searchParams.get('type') === 'signup') {
    console.log('Middleware - Supabase verification link detected, redirecting to success page')
    const url = new URL('/verify-email/success', request.url)
    // Preserve the token and type parameters
    url.searchParams.set('token', request.nextUrl.searchParams.get('token') || '')
    url.searchParams.set('type', request.nextUrl.searchParams.get('type') || '')
    return NextResponse.redirect(url)
  }
  
  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    // console.log('Middleware - Public route, allowing access')
    return NextResponse.next()
  }
  
  // Get tokens from cookies
  const token = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value
  
  console.log('Middleware - Auth check:', { 
    path: pathname, 
    hasToken: !!token, 
    hasRefreshToken: !!refreshToken 
  })
  
  // If trying to access protected route without any token
  if (!token && !refreshToken) {
    console.log('Middleware - No tokens found, redirecting to login')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If we have a token, check role-based access
  if (token) {
    const userRole = getJWTRole(token)
    console.log('Middleware - User role from JWT:', userRole)
    
    if (userRole) {
      // Admin routes - accessible by admin and superadmin
      if (pathname.startsWith('/admin')) {
        if (userRole !== 'admin' && userRole !== 'superadmin') {
          console.log('Middleware - Insufficient permissions for admin route')
          const redirectTo = userRole === 'agent' ? '/agent' : '/'
          return NextResponse.redirect(new URL(redirectTo, request.url))
        }
      }
      
      // Agent routes - accessible by agent, admin, and superadmin
      if (pathname.startsWith('/agent')) {
        if (!['agent', 'admin', 'superadmin'].includes(userRole)) {
          console.log('Middleware - Insufficient permissions for agent route')
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
      
      // Superadmin routes - only accessible by superadmin
      if (pathname.startsWith('/superadmin')) {
        if (userRole !== 'superadmin') {
          console.log('Middleware - Insufficient permissions for superadmin route')
          const redirectTo = userRole === 'admin' ? '/admin' : userRole === 'agent' ? '/agent' : '/'
          return NextResponse.redirect(new URL(redirectTo, request.url))
        }
      }
    }
  }

  // If authenticated user is trying to access auth pages, redirect to dashboard
  if (token && ['/login', '/register'].includes(pathname)) {
    const userRole = getJWTRole(token)
    console.log('Middleware - Authenticated user accessing auth page, redirecting to dashboard')
    
    let redirectTo = '/'
    if (userRole === 'superadmin') {
      redirectTo = '/superadmin'
    } else if (userRole === 'admin') {
      redirectTo = '/admin'
    } else if (userRole === 'agent') {
      redirectTo = '/agent'
    }
    
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  console.log('Middleware - Allowing access to:', pathname)
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
