'use server'

import { createClient } from '@/lib/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'

export interface SignUpData {
  email: string
  password: string
  username: string
  first_name?: string
  last_name?: string
}

export interface SignInData {
  email: string
  password: string
}

export interface SignUpResult {
  user: User | null
  session: Session | null
  error?: string
}

export interface SignInResult {
  user: User | null
  session: Session | null
  error?: string
}

export interface SignOutResult {
  success: boolean
  error?: string
}

export interface ResetPasswordEmailResult {
  success: boolean
  message?: string
  error?: string
}

export interface UpdatePasswordResult {
  success: boolean
  message?: string
  error?: string
}

/**
 * Sign up a new user with Supabase Auth
 */
export async function signUp(formData: SignUpData): Promise<SignUpResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: 'agent', // Default role
      },
    },
  })

  if (error) {
    console.warn('Sign up error:', error)
    return { user: null, session: null, error: error.message }
  }

  // Revalidate the layout to reflect auth changes
  revalidatePath('/', 'layout')

  return { user: data.user, session: data.session }
}

/**
 * Sign in a user with Supabase Auth
 */
export async function signIn(formData: SignInData): Promise<SignInResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })

  if (error) {
    console.warn('Sign in error:', error)
    return { user: null, session: null, error: error.message }
  }

  // Revalidate the layout to reflect auth changes
  revalidatePath('/', 'layout')

  return { user: data.user, session: data.session }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<SignOutResult | undefined> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.warn('Sign out error:', error)
    return { success: false, error: 'Unable to sign out. Please try again.' }
  }

  // Revalidate and redirect
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Reset password for email
 */
export async function resetPasswordForEmail(email: string): Promise<ResetPasswordEmailResult> {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/confirm?type=recovery`,
  })

  if (error) {
    console.warn('Reset password error:', error)
    return { success: false, error: error.message }
  }

  return { success: true, message: 'Password reset email sent' }
}

/**
 * Update user password
 */
export async function updatePassword(password: string): Promise<UpdatePasswordResult> {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: password,
  })

  if (error) {
    console.warn('Update password error:', error)
    return { success: false, error: error.message }
  }

  // Revalidate the layout
  revalidatePath('/', 'layout')

  return { success: true, message: 'Password updated successfully' }
}

/**
 * Get current user
 */
export async function getUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error('Get user error:', error)
    return null
  }

  return user
}

/**
 * Get current session
 */
export async function getSession() {
  const supabase = await createClient()

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    console.error('Get session error:', error)
    return null
  }

  return session
}
