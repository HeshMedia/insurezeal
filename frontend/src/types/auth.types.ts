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
    user_role: string  // Made required since backend always returns this
  }
  message?: string
}

export interface ResetPasswordData {
  new_password: string
  access_token: string
  refresh_token: string
}
