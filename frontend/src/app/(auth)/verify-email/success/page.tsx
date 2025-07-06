"use client"

import * as React from "react"
import { useState, useEffect, Suspense } from "react"
import { CheckCircle, Mail, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

const VerifyEmailSuccessContent = () => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState("")
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if we have the verification token and type from Supabase
    const token = searchParams?.get('token')
    const type = searchParams?.get('type')
    
    if (token && type === 'signup') {
      // Email verification was successful
      setStatus('success')
      setMessage("Your email has been successfully verified!")
    } else if (searchParams?.get('error')) {
      // There was an error in verification
      setStatus('error')
      setMessage("There was an error verifying your email. The link may be expired or invalid.")
    } else {
      // Unknown state
      setStatus('error')
      setMessage("Invalid verification link.")
    }
  }, [searchParams])

  if (status === 'verifying') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white rounded-xl z-1">
        <div className="w-full max-w-md bg-gradient-to-b from-sky-50/50 to-white rounded-3xl shadow-xl shadow-opacity-10 p-8 flex flex-col items-center border border-blue-100 text-black">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-6 shadow-lg shadow-opacity-5">
            <Mail className="w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-semibold mb-2 text-center">
            Verifying Email...
          </h2>
          <p className="text-gray-500 text-sm mb-6 text-center">
            Please wait while we verify your email address.
          </p>
          
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white rounded-xl z-1">
        <div className="w-full max-w-md bg-gradient-to-b from-green-50/50 to-white rounded-3xl shadow-xl shadow-opacity-10 p-8 flex flex-col items-center border border-green-100 text-black">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 mb-6 shadow-lg shadow-opacity-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-semibold mb-2 text-center text-green-800">
            Email Verified Successfully!
          </h2>
          <p className="text-gray-600 text-sm mb-6 text-center leading-relaxed">
            Great! Your email address has been verified. You can now sign in to your InsureZeal account.
          </p>

          <div className="w-full mb-6">
            <div className="text-sm text-green-700 text-center bg-green-50 p-4 rounded-lg border border-green-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium mb-1">Account Status:</p>
                <ul className="text-xs space-y-1">
                  <li>✓ Email verified</li>
                  <li>✓ Account activated</li>
                  <li>✓ Ready to sign in</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="text-center space-y-3 w-full">
            <Link 
              href="/login"
              className="inline-flex items-center justify-center w-full bg-gradient-to-b from-green-600 to-green-700 text-white font-medium py-3 rounded-xl shadow hover:brightness-105 cursor-pointer transition"
            >
              Sign In to Your Account
            </Link>
            
            <p className="text-sm text-gray-600">
              Need help?{' '}
              <Link href="/reset-password" className="font-medium text-blue-600 hover:text-blue-500">
                Reset your password
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white rounded-xl z-1">
      <div className="w-full max-w-md bg-gradient-to-b from-red-50/50 to-white rounded-3xl shadow-xl shadow-opacity-10 p-8 flex flex-col items-center border border-red-100 text-black">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 mb-6 shadow-lg shadow-opacity-5">
          <Mail className="w-8 h-8 text-red-600" />
        </div>
        
        <h2 className="text-2xl font-semibold mb-2 text-center text-red-800">
          Verification Failed
        </h2>
        <p className="text-gray-600 text-sm mb-6 text-center leading-relaxed">
          {message}
        </p>

        <div className="w-full mb-6">
          <div className="text-sm text-red-700 text-center bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="font-medium mb-2">What you can do:</p>
            <ul className="text-xs space-y-1 text-left">
              <li>• Check if the link is complete</li>
              <li>• Try requesting a new verification email</li>
              <li>• Contact support if the issue persists</li>
            </ul>
          </div>
        </div>
        
        <div className="text-center space-y-3 w-full">
          <Link 
            href="/register"
            className="inline-flex items-center justify-center w-full bg-gradient-to-b from-blue-600 to-blue-700 text-white font-medium py-3 rounded-xl shadow hover:brightness-105 cursor-pointer transition"
          >
            Try Signing Up Again
          </Link>
          
          <Link href="/login" className="text-sm text-gray-600 hover:text-blue-600 flex items-center justify-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

const VerifyEmailSuccessPage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailSuccessContent />
    </Suspense>
  )
}

export default VerifyEmailSuccessPage
