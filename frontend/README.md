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