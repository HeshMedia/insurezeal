"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Mail, CheckCircle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

const VerifyEmailPage = () => {
  const [email, setEmail] = useState("")
  
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Get email from URL params if available
    const emailParam = searchParams?.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white rounded-xl z-1">
      <div className="w-full max-w-md bg-gradient-to-b from-sky-50/50 to-white rounded-3xl shadow-xl shadow-opacity-10 p-8 flex flex-col items-center border border-blue-100 text-black">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-6 shadow-lg shadow-opacity-5">
          <Mail className="w-8 h-8 text-blue-600" />
        </div>
        
        <h2 className="text-2xl font-semibold mb-2 text-center">
          Check Your Email
        </h2>
          <p className="text-gray-500 text-sm mb-6 text-center leading-relaxed">
          We&apos;ve sent a verification link to {email ? <span className="font-medium text-gray-700">{email}</span> : 'your email address'}. 
          Please check your inbox and click the link to verify your account.
        </p>

        <div className="w-full mb-6">
          <div className="text-sm text-blue-600 text-center bg-blue-50 p-4 rounded-lg border border-blue-200 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium mb-1">What&apos;s next?</p>
              <ul className="text-xs space-y-1 text-blue-700">
                <li>• Check your email inbox</li>
                <li>• Look for an email from InsureZeal</li>
                <li>• Click the verification link</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="text-center space-y-3 w-full">
        
          
          <p className="text-sm text-gray-600">
            Wrong email?{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up again
            </Link>
          </p>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">          <p className="text-xs text-yellow-700 text-center">
            <strong>Don&apos;t see the email?</strong> Check your spam folder or wait a few minutes for delivery.
          </p>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmailPage
