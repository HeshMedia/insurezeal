import { LoginData, RegisterData, AuthResponse, ResetPasswordData, RefreshTokenResponse } from '@/types/auth.types'
import apiClient from '.'

export const authApi = {
  // Login
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data)
    return response.data
  },

  // Register
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', data)
    return response.data
  },

  // Refresh token
  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    const response = await apiClient.post(
      `/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
    return response.data
  },

  // Logout
  logout: async () => {
    // Assuming there is an endpoint for logout that invalidates the token on the server
    // If not, this can just be a client-side cookie removal
    // await apiClient.post('/auth/logout')
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

  // Verify reset token
  verifyResetToken: async (data: { access_token: string; refresh_token: string }) => {
    const response = await apiClient.post('/auth/verify-reset-token', data)
    return response.data
  },

  // Verify email
  verifyEmail: async (token: string) => {
    const response = await apiClient.post(`/auth/verify-email?token=${token}`)
    return response.data
  },

  // Resend verification email
  resendVerificationEmail: async (email: string) => {
    const response = await apiClient.post('/auth/resend-verification-email', { email })
    return response.data
  }
}
