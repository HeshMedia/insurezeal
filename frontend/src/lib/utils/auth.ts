import { User } from '@supabase/supabase-js'

export type UserRole = 'superadmin' | 'admin' | 'agent'

/**
 * Extract user role from Supabase user object
 * Role can be stored in user_metadata.role or app_metadata.role
 */
export function getUserRole(user: User | null): UserRole | null {
  if (!user) return null

  // Try user_metadata first (custom user data)
  const userRole = user.user_metadata?.role
  if (userRole && ['superadmin', 'admin', 'agent'].includes(userRole)) {
    return userRole as UserRole
  }

  // Try app_metadata (admin-set data)
  const appRole = user.app_metadata?.role
  if (appRole && ['superadmin', 'admin', 'agent'].includes(appRole)) {
    return appRole as UserRole
  }

  // Default to agent if no role found
  return 'agent'
}

/**
 * Check if user has permission to access a route based on role
 */
export function hasRoutePermission(userRole: UserRole | null, route: string): boolean {
  if (!userRole) return false

  if (route.startsWith('/superadmin')) {
    return userRole === 'superadmin'
  }

  if (route.startsWith('/admin')) {
    return ['admin', 'superadmin'].includes(userRole)
  }

  if (route.startsWith('/agent')) {
    return ['agent', 'admin', 'superadmin'].includes(userRole)
  }

  return true
}

/**
 * Get redirect path based on user role
 */
export function getDefaultRedirectPath(userRole: UserRole): string {
  switch (userRole) {
    case 'superadmin':
      return '/superadmin'
    case 'admin':
      return '/admin'
    case 'agent':
      return '/agent'
    default:
      return '/'
  }
}
