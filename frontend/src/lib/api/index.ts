import axios, { AxiosInstance } from 'axios'
import Cookies from 'js-cookie'
import { authApi } from './auth'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

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
          const response = await authApi.refreshToken(refreshToken)

          const newToken = response.access_token
          const newRefreshToken = response.refresh_token
          const rememberMe = localStorage.getItem('remember_me') === 'true'

          // Set cookie with appropriate expiry
          Cookies.set('access_token', newToken, {
            expires: rememberMe ? 30 : 7,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
          })

          if (newRefreshToken) {
            Cookies.set('refresh_token', newRefreshToken, {
              expires: rememberMe ? 365 : 30,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production'
            })
          }

          // Update the authorization header on the original request
          originalRequest.headers.Authorization = `Bearer ${newToken}`

          // Retry the original request
          return apiClient(originalRequest)
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          // If refresh fails, clear cookies and redirect to login
          Cookies.remove('access_token')
          Cookies.remove('refresh_token')
          // Optionally redirect to login page
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return Promise.reject(refreshError)
        }
      } else {
        console.error('No refresh token available.')
        // No refresh token, so reject
        return Promise.reject(error)
      }
    }

    // For other errors, just pass them on
    return Promise.reject(error)
  }
)

export default apiClient
