#!/bin/bash
set -e

echo "🚀 k8s-http-to-flu-to-server 배포 시작"
echo "📍 대상: Kind 클러스터 (log-cluster)"
echo ""

# 현재 스크립트 위치 기준으로 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "📂 프로젝트 경로: $PROJECT_ROOT"
echo ""

# Kind 클러스터 확인
if ! kind get clusters | grep -q "log-cluster"; then
    echo "❌ 'log-cluster' Kind 클러스터를 찾을 수 없습니다."
    echo ""
    echo "다음 명령어로 클러스터를 생성하세요:"
    echo "  kind create cluster --config $SCRIPT_DIR/kind-config.yaml --name log-cluster"
    echo ""
    exit 1
fi

echo "✅ Kind 클러스터 확인 완료"
echo ""

# Kind 클러스터 context 설정
kubectl config use-context kind-log-cluster > /dev/null 2>&1

# Ingress Controller 확인 및 설치
echo "🔍 Ingress Controller 확인 중..."
if ! kubectl get pods -n ingress-nginx | grep -q "ingress-nginx-controller"; then
    echo "📦 Ingress Controller 설치 중..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

    echo "⏳ Ingress Controller가 준비될 때까지 대기 중..."
    kubectl wait --namespace ingress-nginx \
      --for=condition=ready pod \
      --selector=app.kubernetes.io/component=controller \
      --timeout=90s

    echo "✅ Ingress Controller 설치 완료"
else
    echo "✅ Ingress Controller 이미 설치됨"

    # control-plane에서 실행 중인지 확인
    INGRESS_NODE=$(kubectl get pods -n ingress-nginx -o wide | grep ingress-nginx-controller | awk '{print $7}')
    if [[ "$INGRESS_NODE" == *"control-plane"* ]]; then
        echo "   └─ control-plane에서 실행 중 ✓"
    else
        echo "   └─ ⚠️  $INGRESS_NODE 에서 실행 중 (control-plane이 아님)"
    fi
fi
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
cd "$PROJECT_ROOT/k8s_userside_log_generator/log_collect_server"
docker build -t log-collector:latest . -q

echo "  - log-generator 이미지 빌드..."
cd "$PROJECT_ROOT/k8s_userside_log_generator/log_generator_server"
docker build -t log-generator:latest . -q

echo "✅ Docker 이미지 빌드 완료"
echo ""

# 3. Kind 클러스터에 이미지 로드
echo "📦 Kind 클러스터에 이미지 로드 중..."
kind load docker-image log-collector:latest --name log-cluster
kind load docker-image log-generator:latest --name log-cluster
echo "✅ 이미지 로드 완료"
echo ""

# 4. Kubernetes 리소스 배포
echo "☸️  Kubernetes 리소스 배포 중..."
cd "$SCRIPT_DIR"

kubectl apply -f log-generator-deployment.yaml
kubectl apply -f log-collect-deployment.yaml
kubectl apply -f fluent-bit.yaml
kubectl apply -f ingress.yaml

echo "✅ Kubernetes 리소스 배포 완료"
echo ""

# 5. 배포 상태 확인
echo "⏳ 파드가 준비될 때까지 대기 중..."
sleep 3

kubectl wait --for=condition=ready pod -l app=log-collector --timeout=60s
kubectl wait --for=condition=ready pod -l app=log-generator --timeout=60s
kubectl wait --for=condition=ready pod -l app=fluent-bit --timeout=60s

echo ""
echo "✅ 모든 파드 준비 완료!"
echo ""

# 6. 배포 확인
echo "📊 배포 상태 확인:"
echo ""
echo "Pods:"
kubectl get pods
echo ""
echo "Services:"
kubectl get services
echo ""
echo "Ingress:"
kubectl get ingress
echo ""

# 7. 사용법 안내
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ k8s-http-to-flu-to-server 배포 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 테스트 방법:"
echo ""
echo "1. API 호출 테스트 (단건):"
echo "   curl http://localhost:8080/api/users/3"
echo ""
echo "2. 자동 로그 생성 (10회):"
echo "   curl http://localhost:8080/api/autolog"
echo ""
echo "3. 수집서버 로그 확인 (FluentBit이 전달한 로그):"
echo "   kubectl logs -l app=log-collector -f"
echo ""
echo "4. 생성서버 로그 확인 (원본 로그):"
echo "   kubectl logs -l app=log-generator -f"
echo ""
echo "5. FluentBit 로그 확인:"
echo "   kubectl logs -l app=fluent-bit -f"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
