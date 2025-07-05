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

export interface UserResponse {
  id: string
  user_id: string
  email: string
  username?: string
  first_name?: string
  last_name?: string
  display_name?: string
  bio?: string
  avatar_url?: string
  date_of_birth?: string
  timezone?: string
  language?: string
  preferences?: Record<string, unknown>
  created_at: string
  updated_at: string
  user_role: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: UserResponse
  message?: string
}

export interface RefreshTokenResponse {
  access_token: string
  refresh_token?: string
}

export interface ResetPasswordData {
  new_password: string
  access_token: string
  refresh_token: string
}

export interface VerifyResetTokenData {
  access_token: string
  refresh_token: string
}

export interface ForgotPasswordData {
  email: string
}

// JWT payload interface for type safety
export interface JWTPayload {
  iss: string
  sub: string
  aud: string
  exp: number
  iat: number
  email: string
  phone: string
  app_metadata: {
    provider: string
    providers: string[]
  }
  user_metadata: {
    email: string
    email_verified: boolean
    first_name?: string
    last_name?: string
    phone_verified: boolean
    role?: string
    sub: string
    username?: string
  }
  role: string
  aal: string
  amr: Array<{ method: string; timestamp: number }>
  session_id: string
  is_anonymous: boolean
}
