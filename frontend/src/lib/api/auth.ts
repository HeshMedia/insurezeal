import axios, { AxiosInstance } from 'axios'
import Cookies from 'js-cookie'
import { LoginData, RegisterData, AuthResponse, ResetPasswordData } from '@/types/auth.types'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'An error occurred'
    throw new Error(message)  }
)

export const authApi = {
  // Login
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data)
    const result = response.data
    
    // Store tokens in cookies
    Cookies.set('access_token', result.access_token, { expires: 7 })
    Cookies.set('refresh_token', result.refresh_token, { expires: 30 })

    return result
  },  // Register
  register: async (data: RegisterData): Promise<AuthResponse> => {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const result = response.data
      
      // Store tokens in cookies if registration is successful
      if (result.access_token) {
        Cookies.set('access_token', result.access_token, { expires: 7 })
        Cookies.set('refresh_token', result.refresh_token, { expires: 30 })
      }

      return result
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message 
      throw new Error(message)
    }
  },

  // Refresh token
  refreshToken: async (refreshToken: string) => {
    const response = await apiClient.post(`/auth/refresh?refresh_token=${refreshToken}`)
    const result = response.data
    
    // Update cookies with new tokens
    if (result.access_token) {
      Cookies.set('access_token', result.access_token, { expires: 7 })
      if (result.refresh_token) {
        Cookies.set('refresh_token', result.refresh_token, { expires: 30 })
      }
    }

    return result
  },

  // Logout
  logout: async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch (error) {
      // Continue even if logout fails on server
    } finally {
      // Always clear cookies
      Cookies.remove('access_token')
      Cookies.remove('refresh_token')
    }
  },

  // Forgot password
  forgotPassword: async (email: string) => {
    const response = await apiClient.post('/auth/forgot-password', { email })
    return response.data
  },

  // Reset password
  resetPassword: async (data: ResetPasswordData) => {
    const response = await apiClient.post('/auth/reset-password', data)
    return response.data
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await apiClient.get('/users/me')
    return response.data
  }
}
