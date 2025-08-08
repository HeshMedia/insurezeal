import { redirect } from 'next/navigation'
import { getUser } from '@/lib/utils/supabase/auth'
import { getUserRole, getDefaultRedirectPath } from '@/lib/utils/auth'

interface ProtectedPageProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'agent' | 'superadmin'
}

export default async function ProtectedPage({ children, requiredRole }: ProtectedPageProps) {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  const userRole = getUserRole(user)
  
  if (requiredRole && userRole !== requiredRole) {
    // Redirect to appropriate dashboard
    const redirectPath = userRole ? getDefaultRedirectPath(userRole) : '/login'
    redirect(redirectPath)
  }

  return <>{children}</>
}
