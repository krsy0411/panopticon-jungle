# Assets

정적 리소스 파일들

## 구조

```
assets/
├── images/     # 이미지 파일 (.png, .jpg, .svg 등)
├── icons/      # 아이콘 파일
└── fonts/      # 커스텀 폰트 파일
```

## 사용 예시

```typescript
// 이미지 사용
import Image from 'next/image'
import logo from '@/assets/images/logo.png'

export function Logo() {
  return <Image src={logo} alt="Logo" width={200} height={50} />
}

// 아이콘 사용
import { ReactComponent as SearchIcon } from '@/assets/icons/search.svg'

export function SearchButton() {
  return (
    <button>
      <SearchIcon />
      Search
    </button>
  )
}
```

## 참고
- 작은 정적 파일들은 `public/` 폴더에 두는 것도 좋습니다
- Next.js의 Image 컴포넌트를 사용하면 자동 최적화됩니다
