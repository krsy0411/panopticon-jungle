'use client'

import { useRouter } from 'next/navigation'
import Landing from '@/components/features/Landing'

export default function Page() {
  const router = useRouter()
  return <Landing onLoginClick={() => router.push('/login')} />
}

