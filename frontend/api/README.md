# API

백엔드 API 호출 함수들

## 예시

```typescript
// api/client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// api/users.ts
import { apiRequest } from './client'
import { User } from '@/types/user'

export async function getUsers(): Promise<User[]> {
  return apiRequest<User[]>('/api/users')
}

export async function getUserById(id: string): Promise<User> {
  return apiRequest<User>(`/api/users/${id}`)
}

export async function createUser(user: Omit<User, 'id'>): Promise<User> {
  return apiRequest<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
  })
}
```
