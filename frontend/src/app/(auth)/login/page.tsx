"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { LogIn, Lock, Mail, Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/lib/auth-context-final"
import Link from "next/link"
import { useRouter } from "next/navigation"

const LoginPage = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()// Handle Supabase recovery tokens from URL hash
  useEffect(() => {
    const handleSupabaseRecovery = () => {
      const hash = window.location.hash
      // console.log('Hash:', hash) // Debug log (removed for production safety)
      
      if (hash.includes('access_token') && hash.includes('type=recovery')) {
        // Parse the hash parameters
        const params = new URLSearchParams(hash.substring(1)) // Remove the #
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        
        // Removed logging of extracted tokens for security
        
        if (access_token && refresh_token) {
          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname)
          // Redirect to reset password page with tokens
          router.push(`/reset-password?access_token=${access_token}&refresh_token=${refresh_token}`)
        } else {
          console.error('Missing tokens:', { access_token: !!access_token, refresh_token: !!refresh_token })
        }
      }
    }

    handleSupabaseRecovery()
  }, [router])

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please enter both email and password.")
      return
    }    setError("")
    setLoading(true)

    try {
      await login(email, password, rememberMe)    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white rounded-xl z-1">
      <div className="w-full max-w-sm bg-gradient-to-b from-sky-50/50 to-white rounded-3xl shadow-xl shadow-opacity-10 p-8 flex flex-col items-center border border-blue-100 text-black">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white mb-6 shadow-lg shadow-opacity-5">
          <LogIn className="w-7 h-7 text-black" />
        </div>
        <h2 className="text-2xl font-semibold mb-2 text-center">
          Sign in to InsureZeal
        </h2>
        <p className="text-gray-500 text-sm mb-6 text-center">
          Access your insurance management dashboard
        </p>
        <div className="w-full flex flex-col gap-3 mb-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Mail className="w-4 h-4" />
            </span>
            <input
              placeholder="Email"
              type="email"
              value={email}
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Lock className="w-4 h-4" />
            </span>
            <input
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              onKeyPress={(e) => e.key === 'Enter' && handleSignIn()}
            />            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={loading}
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                Remember me
              </label>
            </div>
            <Link href="/reset-password" className="text-xs hover:underline font-medium text-blue-600">
              Forgot password?
            </Link>
          </div>

          {error && (
            <div className="text-sm text-red-500 text-left bg-red-50 p-2 rounded-lg border border-red-200">
              {error}
            </div>
          )}
        </div>
          <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full bg-gradient-to-b from-gray-700 to-gray-900 text-white font-medium py-2 rounded-xl shadow hover:brightness-105 cursor-pointer transition mb-4 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">
            <Link href="/reset-password" className="font-medium text-blue-600 hover:text-blue-500">
              Forgot your password?
            </Link>
          </p>          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
