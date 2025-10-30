# Layout Components

페이지 레이아웃 관련 컴포넌트들

## 예시

```typescript
// components/layout/Header.tsx
import Link from 'next/link'

export function Header() {
  return (
    <header className="header">
      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
      </nav>
    </header>
  )
}

// components/layout/Footer.tsx
export function Footer() {
  return (
    <footer className="footer">
      <p>&copy; 2024 Panopticon. All rights reserved.</p>
    </footer>
  )
}

// components/layout/Sidebar.tsx
export function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside className="sidebar">
      {children}
    </aside>
  )
}

// components/layout/Container.tsx
export function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto px-4">
      {children}
    </div>
  )
}
```
