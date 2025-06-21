import { useEffect, useState } from 'react'
import { profileApi } from '@/lib/api/profile'
import { UserProfile } from '@/types/profile.types'
import Cookies from 'js-cookie'

interface UseUserReturn {
  user: UserProfile | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const useUser = (): UseUserReturn => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const token = Cookies.get('access_token')
      if (!token) {
        setUser(null)
        return
      }

      const userData = await profileApi.getCurrentProfile()
      console.log("User data fetched:", userData)
      setUser(userData)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch user')
      setError(error)
      console.error("Error fetching user:", error)
      
      // If it's an auth error, clear tokens
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        Cookies.remove('access_token')
        Cookies.remove('refresh_token')
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  const refetch = async () => {
    await fetchUser()
  }

  return { user, loading, error, refetch }
}

export default useUser
