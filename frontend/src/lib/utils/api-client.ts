import axios, { AxiosInstance } from 'axios'
import Cookies from 'js-cookie'

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token

 export const interceptor = apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default apiClient ;