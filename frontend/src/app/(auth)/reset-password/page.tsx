"use client"

import * as React from "react"
import { useState, Suspense } from "react"
import { Lock, Mail, CheckCircle, ArrowLeft, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { authApi } from "@/lib/api/auth"

const ResetPasswordContent = () => {
  // Check if we have tokens from email link
  const searchParams = useSearchParams()
  const accessToken = searchParams?.get('access_token')
  const refreshToken = searchParams?.get('refresh_token')
  const supabaseToken = searchParams?.get('supabase_token')
  
  // If we have tokens (either custom API or Supabase), show reset form. Otherwise show forgot password form.
  const hasTokens = (accessToken && refreshToken) || supabaseToken
  if (hasTokens) {
    return <ResetPasswordForm 
      accessToken={accessToken || undefined} 
      refreshToken={refreshToken || undefined} 
      supabaseToken={supabaseToken || undefined}
    />
  } else {
    return <ForgotPasswordForm />
  }
}

const ResetPasswordPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}

// Component for forgot password (email input)
const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address.")
      return
    }    setError("")
    setMessage("")
    setLoading(true)

    try {
      await authApi.forgotPassword(email)
      setMessage("If an account with that email exists, a password reset link has been sent.")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white rounded-xl z-1">
      <div className="w-full max-w-sm bg-gradient-to-b from-sky-50/50 to-white rounded-3xl shadow-xl shadow-opacity-10 p-8 flex flex-col items-center border border-blue-100 text-black">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white mb-6 shadow-lg shadow-opacity-5">
          <Lock className="w-7 h-7 text-blue-600" />
        </div>
        
        <h2 className="text-2xl font-semibold mb-2 text-center">
          Forgot Password?
        </h2>
          <p className="text-gray-500 text-sm mb-6 text-center">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>

        <div className="w-full flex flex-col gap-4 mb-6">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Mail className="w-4 h-4" />
            </span>
            <input
              placeholder="Enter your email"
              type="email"
              value={email}
              required
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              onKeyPress={(e) => e.key === 'Enter' && handleForgotPassword()}
            />
          </div>

          {message && (
            <div className="text-sm text-green-600 text-center bg-green-50 p-3 rounded-lg border border-green-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {message}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500 text-center bg-red-50 p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}
        </div>
        
        <button
          onClick={handleForgotPassword}
          disabled={loading}
          className="w-full bg-gradient-to-b from-blue-600 to-blue-700 text-white font-medium py-2 rounded-xl shadow hover:brightness-105 cursor-pointer transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
        
        <div className="text-center">
          <Link href="/login" className="text-sm text-gray-600 hover:text-blue-600 flex items-center justify-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

// Component for reset password (new password input)
const ResetPasswordForm = ({ 
  accessToken, 
  refreshToken, 
  supabaseToken 
}: { 
  accessToken?: string, 
  refreshToken?: string,
  supabaseToken?: string
}) => {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      setError("Please fill in all fields.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }    if (password !== confirmPassword) {
      setError("Passwords don&apos;t match.")
      return
    }setError("")
    setMessage("")
    setLoading(true)

    try {
      if (supabaseToken) {
        // Handle Supabase token - you'll need to implement this based on your setup
        // For now, show error that Supabase auth is not fully implemented
        setError("Supabase authentication is not fully configured. Please use the forgot password form below.")
        return
      } else if (accessToken && refreshToken) {
        // Handle custom API tokens
        await authApi.resetPassword({
          new_password: password,
          access_token: accessToken,
          refresh_token: refreshToken
        })
      } else {
        setError("Invalid reset link. Please try requesting a new password reset.")
        return
      }

      setMessage("Password reset successfully! Redirecting to login...")
        // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white rounded-xl z-1">
      <div className="w-full max-w-sm bg-gradient-to-b from-sky-50/50 to-white rounded-3xl shadow-xl shadow-opacity-10 p-8 flex flex-col items-center border border-blue-100 text-black">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white mb-6 shadow-lg shadow-opacity-5">
          <Lock className="w-7 h-7 text-green-600" />
        </div>
        
        <h2 className="text-2xl font-semibold mb-2 text-center">
          Reset Your Password
        </h2>
        
        <p className="text-gray-500 text-sm mb-6 text-center">
          Enter your new password below.
        </p>

        <div className="w-full flex flex-col gap-4 mb-6">          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Lock className="w-4 h-4" />
            </span>
            <input
              placeholder="New Password"
              type={showPassword ? "text" : "password"}
              value={password}
              required
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Lock className="w-4 h-4" />
            </span>
            <input
              placeholder="Confirm New Password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              required
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              minLength={6}
              onKeyPress={(e) => e.key === 'Enter' && handleResetPassword()}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {message && (
            <div className="text-sm text-green-600 text-center bg-green-50 p-3 rounded-lg border border-green-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {message}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500 text-center bg-red-50 p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}
        </div>
        
        <button
          onClick={handleResetPassword}
          disabled={loading}
          className="w-full bg-gradient-to-b from-green-600 to-green-700 text-white font-medium py-2 rounded-xl shadow hover:brightness-105 cursor-pointer transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
        
        <div className="text-center">
          <Link href="/login" className="text-sm text-gray-600 hover:text-blue-600 flex items-center justify-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
