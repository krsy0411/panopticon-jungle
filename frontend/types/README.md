# Types

TypeScript 타입 및 인터페이스 정의

## 예시

```typescript
// types/user.ts
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

// types/common.ts
export type Status = 'idle' | 'loading' | 'success' | 'error'

export interface ApiResponse<T> {
  data: T
  message?: string
  error?: string
}

// types/api.ts
export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}
```
