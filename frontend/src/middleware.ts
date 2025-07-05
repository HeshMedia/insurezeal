import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Get tokens from cookies
  const token = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value
  
  console.log('Middleware - Path:', pathname, 'Token exists:', !!token, 'Refresh exists:', !!refreshToken)
  
  // If trying to access protected route without any token
  if (!token && !refreshToken && !isPublicRoute(pathname)) {
    console.log('Redirecting to login - no tokens')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based route protection
  if (token) {
    try {
      // Basic JWT decode to get user role (without verification since backend will verify)
      const base64Payload = token.split('.')[1]
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString())
      const userRole = payload?.user_role
      
      console.log('Middleware - User role:', userRole, 'Accessing:', pathname)
      
      // Check role-based access
      if (userRole) {
        // Admin routes
        if (pathname.startsWith('/admin') && userRole !== 'admin' && userRole !== 'superadmin') {
          console.log('Redirecting admin route - insufficient permissions')
          return NextResponse.redirect(new URL(userRole === 'agent' ? '/agent' : '/', request.url))
        }
        
        // Agent routes
        if (pathname.startsWith('/agent') && userRole !== 'agent' && userRole !== 'admin' && userRole !== 'superadmin') {
          console.log('Redirecting agent route - insufficient permissions')
          return NextResponse.redirect(new URL(userRole === 'admin' ? '/admin' : userRole === 'superadmin' ? '/superadmin' : '/', request.url))
        }
        
        // Superadmin routes
        if (pathname.startsWith('/superadmin') && userRole !== 'superadmin') {
          console.log('Redirecting superadmin route - insufficient permissions')
          return NextResponse.redirect(new URL(userRole === 'admin' ? '/admin' : userRole === 'agent' ? '/agent' : '/', request.url))
        }
      }
    } catch (error) {
      console.error('Middleware - Error decoding token:', error)
      // If token decode fails, let the backend handle the authentication
    }
  }

  // If authenticated and trying to access auth pages (but not home), redirect to appropriate dashboard
  if (token && ['/login', '/register'].includes(pathname)) {
    try {
      const base64Payload = token.split('.')[1]
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString())
      const userRole = payload?.user_role
      
      console.log('Redirecting from auth page - has token, role:', userRole)
      
      if (userRole === 'superadmin') {
        return NextResponse.redirect(new URL('/superadmin', request.url))
      } else if (userRole === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url))
      } else if (userRole === 'agent') {
        return NextResponse.redirect(new URL('/agent', request.url))
      }
      
      return NextResponse.redirect(new URL('/', request.url))
    } catch (error) {
      console.error('Middleware - Error redirecting from auth page:', error)
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

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
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
