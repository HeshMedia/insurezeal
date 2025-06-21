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

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If we get 401 and haven't already tried refreshing
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = Cookies.get('refresh_token')
      if (refreshToken) {
        try {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh?refresh_token=${refreshToken}`
          )
          
          const newToken = response.data.access_token
          const rememberMe = localStorage.getItem('remember_me') === 'true'
          
          // Set cookie with appropriate expiry
          Cookies.set('access_token', newToken, { 
            expires: rememberMe ? 30 : 7,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
          })
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return apiClient(originalRequest)
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          Cookies.remove('access_token')
          Cookies.remove('refresh_token')
          localStorage.removeItem('remember_me')
          
          // Only redirect if we're not already on a public page
          if (typeof window !== 'undefined' && 
              !window.location.pathname.includes('/login') && 
              !window.location.pathname.includes('/register')) {
            window.location.href = '/login'
          }
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token, redirect to login
        Cookies.remove('access_token')
        Cookies.remove('refresh_token')
        localStorage.removeItem('remember_me')
        
        if (typeof window !== 'undefined' && 
            !window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/register')) {
          window.location.href = '/login'
        }
      }
    }

    const message = error.response?.data?.detail || error.message || 'An error occurred'
    throw new Error(message)
  }
)

export const authApi = {  // Login
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data)
    return response.data
  },
  // Register
  register: async (data: RegisterData): Promise<AuthResponse> => {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message 
      throw new Error(message)
    }
  },
  // Refresh token
  refreshToken: async (refreshToken: string) => {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh?refresh_token=${refreshToken}`
    )
    const result = response.data
    
    // Update cookies with new tokens
    if (result.access_token) {
      const rememberMe = localStorage.getItem('remember_me') === 'true'
      Cookies.set('access_token', result.access_token, { 
        expires: rememberMe ? 30 : 7,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      })
      if (result.refresh_token) {
        Cookies.set('refresh_token', result.refresh_token, { 
          expires: rememberMe ? 365 : 30,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        })
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
      localStorage.removeItem('remember_me')
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

  // Verify email
  verifyEmail: async (token: string) => {
    const response = await apiClient.post('/auth/verify-email', { token })
    return response.data
  },

  // Resend verification email
  resendVerificationEmail: async (email: string) => {
    const response = await apiClient.post('/auth/resend-verification', { email })
    return response.data
  },
}
