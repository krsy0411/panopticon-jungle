#!/bin/bash
set -e

echo "🚀 k8s-dummy-flu-server 배포 시작"
echo "📍 대상: Docker Desktop Kubernetes (일반 K8s)"
echo ""

# 현재 스크립트 위치 기준으로 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "📂 프로젝트 경로: $PROJECT_ROOT"
echo ""

# 1. 기존 FluentBit 삭제 (다른 테스트의 FluentBit 설정과 충돌 방지)
echo "🧹 기존 FluentBit 리소스 정리..."
kubectl delete daemonset fluent-bit --ignore-not-found=true
kubectl delete configmap fluent-bit-config --ignore-not-found=true
kubectl delete serviceaccount fluent-bit --ignore-not-found=true
kubectl delete clusterrole fluent-bit --ignore-not-found=true
kubectl delete clusterrolebinding fluent-bit --ignore-not-found=true
echo "✅ 기존 FluentBit 정리 완료"
echo ""

# 2. Docker 이미지 빌드
echo "🔨 Docker 이미지 빌드 중..."

echo "  - log-collector 이미지 빌드..."
cd "$PROJECT_ROOT/log_collect_tests/log_collect_server"
docker build -t log-collector:latest . -q

echo "  - log-generator 이미지 빌드..."
cd "$PROJECT_ROOT/log_collect_tests/log_generator_server"
docker build -t log-generator:latest . -q

echo "✅ Docker 이미지 빌드 완료"
echo ""

# 3. Kubernetes 배포
echo "☸️  Kubernetes 리소스 배포 중..."
cd "$SCRIPT_DIR"

kubectl apply -f log-generator-deployment.yaml
kubectl apply -f log-collector-deployment.yaml
kubectl apply -f fluent-bit-config.yaml
kubectl apply -f fluent-bit-daemonset.yaml

echo "✅ Kubernetes 리소스 배포 완료"
echo ""

# 4. 배포 상태 확인
echo "⏳ 파드가 준비될 때까지 대기 중..."
sleep 3

kubectl wait --for=condition=ready pod -l app=log-collector --timeout=60s
kubectl wait --for=condition=ready pod -l app=log-generator --timeout=60s
kubectl wait --for=condition=ready pod -l app=fluent-bit --timeout=60s

echo ""
echo "✅ 모든 파드 준비 완료!"
echo ""

# 5. 배포 확인
echo "📊 배포 상태 확인:"
echo ""
kubectl get pods
echo ""

# 6. 사용법 안내
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ k8s-dummy-flu-server 배포 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 테스트 방법:"
echo ""
echo "1. 자동 로그 생성 (10회):"
echo "   curl http://localhost:8080/api/autolog"
echo ""
echo "2. 수집서버 로그 확인 (FluentBit이 전달한 로그):"
echo "   kubectl logs -l app=log-collector -f"
echo ""
echo "3. 생성서버 로그 확인 (원본 로그):"
echo "   kubectl logs -l app=log-generator -f"
echo ""
echo "4. FluentBit 로그 확인:"
echo "   kubectl logs -l app=fluent-bit -f"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
