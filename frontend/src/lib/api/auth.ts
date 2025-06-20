import Cookies from 'js-cookie'

const API_BASE = process.env.NEXT_PUBLIC_API_URL 

export interface LoginData {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  username: string
  first_name?: string
  last_name?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: {
    id: string
    user_id: string
    email: string
    username: string
    first_name?: string
    last_name?: string
    user_role?: string
  }
  message?: string
}

export const authApi = {
  // Call your backend for login
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Login failed' }))
      throw new Error(errorData.detail || 'Login failed')
    }

    const result = await response.json()
    
    // Store tokens in cookies
    Cookies.set('access_token', result.access_token, { expires: 7 })
    Cookies.set('refresh_token', result.refresh_token, { expires: 30 })

    return result
  },
  // Call your backend for registration
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Registration failed' }))
      throw new Error(errorData.detail || 'Registration failed')
    }

    const result = await response.json()
    
    // Store tokens in cookies if registration is successful
    if (result.access_token) {
      Cookies.set('access_token', result.access_token, { expires: 7 })
      Cookies.set('refresh_token', result.refresh_token, { expires: 30 })
    }

    return result
  },

  // Call your backend for refresh
  refreshToken: async (refreshToken: string) => {
    const response = await fetch(`${API_BASE}/auth/refresh?refresh_token=${refreshToken}`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const result = await response.json()
    
    // Update cookies with new tokens
    if (result.access_token) {
      Cookies.set('access_token', result.access_token, { expires: 7 })
      if (result.refresh_token) {
        Cookies.set('refresh_token', result.refresh_token, { expires: 30 })
      }
    }

    return result
  },

  // Call your backend for logout
  logout: async () => {
    const token = Cookies.get('access_token')
    
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
    }
    
    // Clear cookies
    Cookies.remove('access_token')
    Cookies.remove('refresh_token')
  },

  // Call your backend for forgot password
  forgotPassword: async (email: string) => {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Forgot password failed' }))
      throw new Error(errorData.detail || 'Forgot password failed')
    }

    return response.json()
  },
  // Call your backend to get current user
  getCurrentUser: async () => {
    const token = Cookies.get('access_token')
    
    if (!token) {
      throw new Error('No session')
    }

    const response = await fetch(`${API_BASE}/users/me`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to get user')
    }

    return response.json()
  }
}
