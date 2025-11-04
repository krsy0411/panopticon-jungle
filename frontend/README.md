# 판옵티콘(Frontend)

## 도커

프로덕션 :

```bash
docker build -t panopticon-frontend -f frontend/Dockerfile frontend/ && docker run -p 3000:3000 panopticon-frontend
```

개발 :

```bash
docker build -t panopticon-frontend-dev -f frontend/Dockerfile.dev frontend/ && docker run -p 3000:3000 -v $(pwd)/frontend:/app -v /app/node_modules panopticon-frontend-dev
```

- `-v $(pwd)/frontend:/app` : 로컬 frontend 폴더를 컨테이너의 /app에 마운트 (핫 리로드 지원)
- `-v /app/node_modules` : node_modules는 컨테이너 것을 사용 (로컬 것과 충돌 방지)

## 현재폴더구조

📁 현재 프로젝트 구조

frontend/
├── app/ # 라우팅 디렉토리 (Next.js 14 App Router)
│ ├── layout.tsx # 전체 레이아웃 (모든 페이지 공통)
│ ├── page.tsx # 메인 페이지 (/)
│ ├── globals.css # 전역 CSS
│ │
│ ├── login/ # /login 경로
│ │ └── page.tsx
│ │
│ ├── dashboard/ # /dashboard 경로
│ │ └── page.tsx # ← middleware로 인증 체크
│ │
│ ├── logs/ # /logs 경로
│ │ └── page.tsx
│ │
│ ├── slo/ # /slo 경로
│ │ └── page.tsx
│ │
│ └── notifications/ # /notifications 경로
│ └── page.tsx
│
├── components/ # 재사용 컴포넌트
│ ├── features/ # ⭐ 비즈니스 로직 컴포넌트
│ │ ├── Auth.tsx # 인증 관련 (13KB - 복잡)
│ │ ├── Dashboard.tsx # 대시보드 메인
│ │ ├── Landing.tsx # 랜딩 페이지
│ │ ├── LogViewer.tsx # 로그 뷰어
│ │ ├── NotificationSettings.tsx # 알림 설정
│ │ └── SLOSettings.tsx # SLO 설정
│ │
│ ├── layout/ # 레이아웃 컴포넌트
│ │ # (Header, Sidebar, Footer 등)
│ │
│ └── ui/ # ⭐ 기본 UI 컴포넌트
│ # (Button, Input, Card 등)
│ # Radix UI + Tailwind 기반
│
├── lib/ # 유틸리티 함수
│ ├── hooks/ # 커스텀 React hooks
│ └── utils/ # 헬퍼 함수
│
├── api/ # ⭐ 백엔드 API 호출 (아직 미구현)
│ └── README.md # 구현 예시만 있음
│
├── stores/ # 전역 상태 관리 (아직 미구현)
│ └── README.md # Zustand 예시만 있음
│
├── types/ # TypeScript 타입 정의
├── styles/ # 추가 스타일
├── public/ # 정적 파일 (이미지 등)
│
├── middleware.ts # ⭐ 미들웨어 (인증 체크)
└── package.json # 의존성
