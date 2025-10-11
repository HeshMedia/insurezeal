'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/utils/supabase/server'
import { getUserRole, getDefaultRedirectPath } from '@/lib/utils/auth'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: result, error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.warn('Login error:', error)
    return { error: 'Invalid email or password. Please try again.' }
  }

  if (result.user) {
    const userRole = getUserRole(result.user)
    const redirectPath = userRole ? getDefaultRedirectPath(userRole) : '/'
    
    revalidatePath('/', 'layout')
    redirect(redirectPath)
  }

  revalidatePath('/', 'layout')
  return { error: 'Unable to sign in. Please try again.' }
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        username: formData.get('username') as string,
        first_name: formData.get('first_name') as string,
        last_name: formData.get('last_name') as string,
        role: 'agent' // Default role
      }
    }
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    console.error('Signup error:', error)
    redirect('/error?message=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/verify-email?email=' + encodeURIComponent(data.email))
}