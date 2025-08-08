import axios, { AxiosInstance } from 'axios'
import { createClient } from '@/lib/utils/supabase/client'

// Create a shared axios instance with Supabase authentication
export const createAuthenticatedClient = (): AxiosInstance => {
  const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor to add auth token from Supabase
  apiClient.interceptors.request.use(async (config) => {
    try {
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Supabase session error:', error)
        return config
      }
      
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
        console.log('API Request with token:', {
          url: config.url,
          method: config.method,
          hasToken: true,
          tokenLength: session.access_token.length
        })
      } else {
        console.warn('No Supabase session found for API request:', config.url)
      }
    } catch (error) {
      console.error('Error getting Supabase session:', error)
    }
    
    return config
  })

  // Response interceptor for better error handling
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.error('API Authentication failed:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data
        })
      }
      return Promise.reject(error)
    }
  )

  return apiClient
}
