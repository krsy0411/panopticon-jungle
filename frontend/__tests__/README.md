# Tests

테스트 파일들

## 구조
- `unit/` - 단위 테스트 (컴포넌트, 함수 등)
- `integration/` - 통합 테스트 (API 호출, 여러 컴포넌트)
- `e2e/` - E2E 테스트 (전체 사용자 플로우)

## 예시

```typescript
// __tests__/unit/components/Button.test.tsx
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    screen.getByText('Click').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

// __tests__/unit/lib/utils.test.ts
import { formatDate, formatNumber } from '@/lib/utils'

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-01')
    expect(formatDate(date)).toBe('2024. 1. 1.')
  })
})

// __tests__/e2e/login.spec.ts (Playwright 예시)
import { test, expect } from '@playwright/test'

test('user can login', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})
```
