#!/bin/bash
set -e

echo "🧹 k8s-http-to-flu-to-server 리소스 삭제 시작"
echo ""

# 현재 스크립트 위치 기준으로 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

echo "🗑️  Kubernetes 리소스 삭제 중..."

kubectl delete -f ingress.yaml --ignore-not-found=true
kubectl delete -f fluent-bit.yaml --ignore-not-found=true
kubectl delete -f log-collect-deployment.yaml --ignore-not-found=true
kubectl delete -f log-generator-deployment.yaml --ignore-not-found=true

echo ""
echo "✅ 모든 리소스 삭제 완료!"
echo ""

# 남은 파드 확인
REMAINING_PODS=$(kubectl get pods --no-headers 2>/dev/null | wc -l | tr -d ' ')

if [ "$REMAINING_PODS" -gt 0 ]; then
    echo "📊 남은 파드:"
    kubectl get pods
else
    echo "✅ 모든 파드가 삭제되었습니다."
fi

echo ""
