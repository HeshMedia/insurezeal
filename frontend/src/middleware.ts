import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/utils/supabase/middleware'
import { getUserRole, hasRoutePermission, getDefaultRedirectPath } from '@/lib/utils/auth'

// Define public routes that don't require authentication
const isPublicRoute = (pathname: string): boolean => {
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/reset-password',
    '/verify-email',
    '/verify-email/success',
    '/forgot-password',
    '/auth/confirm',
    '/error'
  ]
  
  return publicRoutes.includes(pathname) || 
         pathname.startsWith('/api/') ||
         pathname.startsWith('/_next/') ||
         pathname.startsWith('/favicon.ico') ||
         pathname.includes('.')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log('Middleware - Processing path:', pathname)

  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    // Still update session for public routes to maintain auth state
    const { supabaseResponse } = await updateSession(request)
    return supabaseResponse
  }

  // Update Supabase session and get user
  const { supabaseResponse, user } = await updateSession(request)
  
  console.log('Middleware - Auth check:', { 
    path: pathname, 
    hasUser: !!user,
    userEmail: user?.email 
  })

  // If trying to access protected route without authentication
  if (!user) {
    console.log('Middleware - No user found, redirecting to login')
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Get user role
  const userRole = getUserRole(user)
  console.log('Middleware - User role:', userRole)

  // Check route permissions
  if (!hasRoutePermission(userRole, pathname)) {
    console.log('Middleware - Insufficient permissions for route')
    const redirectTo = userRole ? getDefaultRedirectPath(userRole) : '/login'
    const url = request.nextUrl.clone()
    url.pathname = redirectTo
    return NextResponse.redirect(url)
  }

  // If authenticated user is trying to access auth pages, redirect to dashboard
  if (['/login', '/register'].includes(pathname)) {
    console.log('Middleware - Authenticated user accessing auth page, redirecting to dashboard')
    const redirectTo = userRole ? getDefaultRedirectPath(userRole) : '/'
    const url = request.nextUrl.clone()
    url.pathname = redirectTo
    return NextResponse.redirect(url)
  }

  console.log('Middleware - Allowing access to:', pathname)
  return supabaseResponse
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
