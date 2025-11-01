'use client'

import { useRouter } from 'next/navigation'
import Auth from '@/components/features/Auth'
import { Toaster } from '@/components/ui/sonner'

export default function Page() {
  const router = useRouter()
  const onSuccess = () => {
    if (typeof document !== 'undefined') {
      document.cookie = 'auth=1; path=/; max-age=86400'
    }
    router.push('/dashboard')
  }
  const onBack = () => {
    if (typeof document !== 'undefined') {
      document.cookie = 'auth=; path=/; max-age=0'
    }
    router.push('/')
  }

  return (
    <>
      <Auth onLoginSuccess={onSuccess} onBack={onBack} />
      <Toaster />
    </>
  )
}
