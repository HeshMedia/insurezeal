import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole, getDefaultRedirectPath } from '@/lib/utils/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    
    if (!error && data.user) {
      console.log('Email verification successful for:', data.user.email)
      
      // For password recovery, redirect to reset password page
      if (type === 'recovery') {
        redirect('/reset-password?type=recovery')
      }
      
      // For email confirmation, redirect based on user role
      if (type === 'email') {
        const userRole = getUserRole(data.user)
        const redirectPath = userRole ? getDefaultRedirectPath(userRole) : '/'
        redirect(redirectPath)
      }
      
      // Fallback: redirect to specified next URL or root
      redirect(next)
    } else {
      console.error('Email verification failed:', error)
    }
  }

  // redirect the user to an error page with some instructions
  redirect('/error?message=Invalid verification link')
}