# Auth Hooks Usage Guide

This document explains how to use the authentication hooks with TanStack Query in the InsureZeal frontend application.

## Overview

The authentication system now includes:
- `authApi` - API functions for authentication
- `useUser` - Hook to get current user data
- `useAuthQuery` - Collection of auth-related hooks
- Enhanced auth context with proper error handling

## Available Hooks

### 1. `useUser` Hook

The most commonly used hook for getting current user information.

```tsx
import { useUser } from '@/lib/hooks/use-auth-query'

function UserComponent() {
  const { data: user, isLoading, error } = useUser()

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading user</div>
  if (!user) return <div>Not authenticated</div>

  return (
    <div>
      <h1>Welcome, {user.username}!</h1>
      <p>Role: {user.user_role}</p>
      <p>Email: {user.email}</p>
    </div>
  )
}
```

### 2. `useAuthQuery` Hook Collection

For more advanced use cases, use the `useAuthQuery` hook collection:

```tsx
import { useAuthQuery } from '@/lib/hooks/use-auth-query'

function AuthComponent() {
  const {
    useUser,
    useLogin,
    useRegister,
    useLogout,
    useForgotPassword,
    useResetPassword,
    useVerifyEmail,
    useResendVerificationEmail
  } = useAuthQuery()

  const { data: user } = useUser()
  const loginMutation = useLogin()
  const logoutMutation = useLogout()

  const handleLogin = async (email: string, password: string) => {
    try {
      await loginMutation.mutateAsync({ email, password })
      // User will be automatically updated in cache
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync()
      // Cache will be cleared automatically
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <div>
      {user ? (
        <div>
          <p>Welcome, {user.username}!</p>
          <button 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      ) : (
        <div>
          <button 
            onClick={() => handleLogin('email@example.com', 'password')}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Logging in...' : 'Login'}
          </button>
        </div>
      )}
    </div>
  )
}
```

## Auth Context Integration

The auth context still works as before but now has the `getCurrentUser` method available:

```tsx
import { useAuth } from '@/lib/auth-context'

function ComponentWithAuthContext() {
  const { user, loading, login, logout, isAuthenticated } = useAuth()

  if (loading) return <div>Loading...</div>

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>Welcome, {user?.username}!</p>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <div>
          <button onClick={() => login('email@example.com', 'password')}>
            Login
          </button>
        </div>
      )}
    </div>
  )
}
```

## Key Features

### 1. Automatic Token Management
- Tokens are automatically included in requests
- Cookies are managed automatically
- Remember me functionality supported

### 2. Cache Management
- User data is cached for 5 minutes
- Automatic cache invalidation on login/logout
- Optimistic updates for better UX

### 3. Error Handling
- Comprehensive error handling
- Automatic token cleanup on auth failures
- User-friendly error messages

### 4. Background Refetching
- Data is refetched in the background
- Stale data is served while refetching
- Configurable stale times

## Best Practices

### 1. Use `useUser` for Simple Cases
For components that just need to display user information, use the simple `useUser` hook.

### 2. Use `useAuthQuery` for Complex Operations
For components that need to perform auth operations (login, logout, etc.), use the `useAuthQuery` collection.

### 3. Handle Loading States
Always handle loading states for better UX:

```tsx
const { data: user, isLoading, error } = useUser()

if (isLoading) return <LoadingSpinner />
if (error) return <ErrorMessage error={error} />
if (!user) return <LoginPrompt />
```

### 4. Use Optimistic Updates
The hooks automatically handle optimistic updates, so the UI will update immediately on successful operations.

### 5. Error Boundaries
Consider wrapping your app in an error boundary to catch and handle auth errors gracefully.

## Migration Guide

If you're migrating from the old auth system:

1. **Replace direct API calls** with hook-based approach
2. **Update loading states** to use TanStack Query's `isLoading`
3. **Remove manual cache management** - it's handled automatically
4. **Use the new error handling** pattern with `error` from hooks

## TypeScript Support

All hooks are fully typed with TypeScript:

```tsx
import { User } from '@/types/auth.types'

const { data: user }: { data: User | undefined } = useUser()
```

## Performance Considerations

- User data is cached for 5 minutes by default
- Only one request is made even if multiple components use `useUser`
- Background refetching keeps data fresh without blocking UI
- Automatic garbage collection after 10 minutes of inactivity

## Troubleshooting

### Common Issues

1. **Hook not updating after login**
   - Make sure you're using the mutation hooks provided
   - Check that tokens are being stored correctly

2. **Infinite loading state**
   - Verify that the API endpoint `/auth/me` is accessible
   - Check network tab for failed requests

3. **User data not persisting**
   - Ensure cookies are being set correctly
   - Check cookie settings and domain configuration
