'use server'

import { createClient } from '@/lib/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

/**
 * Sign up a new user with Supabase Auth
 */
export async function signUp(formData: SignUpData) {
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
    console.error('Sign up error:', error)
    throw error
  }

  // Revalidate the layout to reflect auth changes
  revalidatePath('/', 'layout')
  
  return data
}

/**
 * Sign in a user with Supabase Auth
 */
export async function signIn(formData: SignInData) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })

  if (error) {
    console.error('Sign in error:', error)
    throw error
  }

  // Revalidate the layout to reflect auth changes
  revalidatePath('/', 'layout')
  
  return data
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Sign out error:', error)
    throw error
  }

  // Revalidate and redirect
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Reset password for email
 */
export async function resetPasswordForEmail(email: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/confirm?type=recovery`,
  })

  if (error) {
    console.error('Reset password error:', error)
    throw error
  }

  return { message: 'Password reset email sent' }
}

/**
 * Update user password
 */
export async function updatePassword(password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: password,
  })

  if (error) {
    console.error('Update password error:', error)
    throw error
  }

  // Revalidate the layout
  revalidatePath('/', 'layout')
  
  return { message: 'Password updated successfully' }
}

/**
 * Get current user
 */
export async function getUser() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

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

  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Get session error:', error)
    return null
  }

  return session
}
