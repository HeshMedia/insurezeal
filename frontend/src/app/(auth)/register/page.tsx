"use client"

import * as React from "react"
import { useState } from "react"
import { UserPlus, Lock, Mail, User, Users, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signUp } from "@/lib/utils/supabase/auth"

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    first_name: '',
    last_name: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formError, setFormError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async () => {
    if (!formData.email || !formData.password || !formData.username) {
      setFormError("Please fill in all required fields.")
      return
    }
    if (formData.password.length < 6) {
      setFormError("Password must be at least 6 characters long.")
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setFormError("Passwords do not match.")
      return
    }
    
    setFormError("")
    setLoading(true)
    
    try {
      const { email, password, username, first_name, last_name } = formData
      const result = await signUp({ email, password, username, first_name, last_name })

      if (result?.error) {
        const normalizedMessage = result.error.toLowerCase().includes('email')
          ? 'An account with this email already exists. Try signing in instead.'
          : 'Unable to create your account. Please check your details and try again.'
        setFormError(normalizedMessage)
        return
      }
      
      // Redirect to email verification page
      router.push(`/verify-email?email=${encodeURIComponent(email)}`)
    } catch (error: unknown) {
      console.error('Registration error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Registration failed. Please try again.'
      setFormError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white rounded-xl z-1">
      <div className="w-full max-w-sm bg-gradient-to-b from-sky-50/50 to-white rounded-3xl shadow-xl shadow-opacity-10 p-8 flex flex-col items-center border border-blue-100 text-black">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white mb-6 shadow-lg shadow-opacity-5">
          <UserPlus className="w-7 h-7 text-black" />
        </div>
        <h2 className="text-2xl font-semibold mb-2 text-center">
          Create Account
        </h2>
        <p className="text-gray-500 text-sm mb-6 text-center">
          Join InsureZeal to manage your insurance operations
        </p>
        
        <div className="w-full flex flex-col gap-3 mb-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Mail className="w-4 h-4" />
            </span>
            <input
              placeholder="Email *"
              type="email"
              name="email"
              value={formData.email}
              required
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <User className="w-4 h-4" />
            </span>
            <input
              placeholder="Username *"
              type="text"
              name="username"
              value={formData.username}
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Users className="w-4 h-4" />
              </span>
              <input
                placeholder="First Name"
                type="text"
                name="first_name"
                value={formData.first_name}
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="relative flex-1">
              <input
                placeholder="Last Name"
                type="text"
                name="last_name"
                value={formData.last_name}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Lock className="w-4 h-4" />
            </span>
            <input
              placeholder="Password *"
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
              onChange={handleChange}
              disabled={loading}
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
              placeholder="Confirm Password *"
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50 text-black text-sm"
              onChange={handleChange}
              disabled={loading}
              onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
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

          {formError && (
            <div className="text-sm text-red-600 text-left bg-red-50 p-3 rounded-lg border border-red-200 max-w-full break-words">
              <div className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">⚠</span>
                <span>{formError}</span>
              </div>
            </div>
          )}
        </div>
        
        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-gradient-to-b from-blue-600 to-blue-700 text-white font-medium py-2 rounded-xl shadow hover:brightness-105 cursor-pointer transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
        
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
