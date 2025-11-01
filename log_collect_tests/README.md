# 테스트 소개

## 테스트 종류

## 1. dummy-to-server

해당 프로그램은 목적지 서버를 설정해 더미 로그를 보내는 프로그램입니다.
Fluent-bit을 통하지 않습니다. 수집서버의 부하테스트를 위함입니다.
후에는 kafka를 통해 흐름제어가 가능한지 판별가능합니다.

### 사용법

1. 코드내에 `CODE_CONFIG` 객체에 원하는 정보를 넣습니다. (목적지, 로그의 양 ..)
2. `npm start` 로 실행

## 2. k8s-dummy-flu-server

해당 프로그램은 쿠버네티스 환경에서 각각의 파드(생성서버)가 **console.log를 자동으로** 찍고,
fluent-bit이 이를 감지하여 수집서버로 데이터를 수집합니다.
Kubernetes 환경에서 stdout 로그 수집 테스트를 위한 프로그램입니다.

### 사용법

#### 방법 1: 자동 배포 스크립트 (권장)

```bash
cd log_collect_tests/k8s_dummy_to_flu_to_server
./deploy.sh
```

스크립트가 자동으로 다음을 수행합니다:

- 기존 FluentBit 리소스 정리 (충돌 방지)
- Docker 이미지 빌드
- Kubernetes 리소스 배포
- 파드 준비 상태 대기
- 사용법 안내

**리소스 삭제:**

```bash
./cleanup.sh
```

#### 방법 2: 수동 배포

1. **Docker 이미지 빌드**

   ```bash
   # 수집서버 이미지 빌드
   cd log_collect_tests/log_collect_server
   docker build -t log-collector:latest .

   # 생성서버 이미지 빌드
   cd ../log_generator_server
   docker build -t log-generator:latest .
   ```

2. **Kind 클러스터에 이미지 로드**

   ```bash
   kind load docker-image log-collector:latest --name log-cluster
   kind load docker-image log-generator:latest --name log-cluster
   ```

3. **Kubernetes 리소스 배포**

   ```bash
   cd ../k8s_dummy_to_flu_to_server

   kubectl apply -f log-generator-deployment.yaml
   kubectl apply -f log-collector-deployment.yaml
   kubectl apply -f fluent-bit-config.yaml
   kubectl apply -f fluent-bit-daemonset.yaml
   ```

4. **배포 확인**

   - `kubectl get pods` - 기본적으로 7개 파드가 Running 상태인지 확인

5. **테스트**

   ```bash
   # 자동 로그 생성 트리거 (10회)
   curl http://localhost:8080/api/autolog
   ```

6. **로그 확인**

   ```bash
   # 수집서버 로그 확인 (FluentBit이 전달한 로그 확인)
   kubectl logs -l app=log-collector -f
   ```

7. **정상 작동 확인**
   - 수집서버 로그에서 생성서버의 로그가 **자동으로** 계속 생성되는지 확인

### 환경설정

dockerDesktop -> 환경설정 -> kubernetes on

---

## 3. k8s-http-to-flu-to-server

해당 프로그램은 쿠버네티스 환경에서 **HTTP API 호출**을 통해 로그를 생성하고,
fluent-bit이 이를 감지하여 수집서버로 전달합니다.
**Ingress**를 통해 외부에서 API에 접근 가능하며, 실제 프로덕션 환경과 유사한 테스트입니다.

### 사용법

#### 방법 1: 자동 배포 스크립트 (권장)

```bash
cd log_collect_tests/k8s_http_to_flu_to_server
./deploy.sh
```

스크립트가 자동으로 다음을 수행합니다:

- Kind 클러스터 확인
- 기존 FluentBit 리소스 정리 (충돌 방지)
- Docker 이미지 빌드
- Kind 클러스터에 이미지 로드
- Kubernetes 리소스 배포 (Ingress 포함)
- 파드 준비 상태 대기
- 사용법 안내

**리소스 삭제:**

```bash
./cleanup.sh
```

**Kind 클러스터가 없는 경우:**

```bash
# kind-config.yaml을 사용하여 클러스터 생성 (Ingress 설정 포함)
kind create cluster --config kind-config.yaml --name log-cluster

# Ingress Controller 설치 (deploy.sh가 자동으로 확인 및 설치하지만, 수동 설치 시)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Ingress Controller 준비 확인
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# control-plane에 설치되었는지 확인
kubectl get pods -n ingress-nginx -o wide
```

#### 방법 2: 수동 배포

1. **Docker 이미지 빌드**

   ```bash
   # 수집서버 이미지 빌드
   cd log_collect_tests/log_collect_server
   docker build -t log-collector:latest .

   # 생성서버 이미지 빌드
   cd ../log_generator_server
   docker build -t log-generator:latest .
   ```

2. **Kind 클러스터에 이미지 로드**

   ```bash
   kind load docker-image log-collector:latest --name log-cluster
   kind load docker-image log-generator:latest --name log-cluster
   ```

3. **Kubernetes 리소스 배포**

   ```bash
   cd ../k8s_http_to_flu_to_server

   kubectl apply -f log-generator-deployment.yaml
   kubectl apply -f log-collect-deployment.yaml
   kubectl apply -f fluent-bit.yaml
   kubectl apply -f ingress.yaml
   ```

4. **배포 확인**

   - `kubectl get pods` - 모든 파드가 Running 상태인지 확인
   - `kubectl get services` - 서비스가 정상 생성되었는지 확인
   - `kubectl get ingress` - Ingress가 localhost로 매핑되었는지 확인

5. **테스트**

   ```bash
   # API 호출 테스트 (단건)
   curl http://localhost:8080/api/users/3

   # 자동 로그 생성 (10회)
   curl http://localhost:8080/api/autolog
   ```

6. **로그 확인**

   ```bash
   # 수집서버 로그 확인 (FluentBit이 전달한 로그 확인)
   kubectl logs -l app=log-collector -f

   # 생성서버 로그 확인 (원본 로그 확인)
   kubectl logs -l app=log-generator -f
   ```

7. **정상 작동 확인**
   - `curl http://localhost:8080/api/autolog` 호출 시
   - 생성서버에서 10번의 로그 출력 확인
   - 수집서버에서 FluentBit을 통해 전달된 로그 수신 확인

### 환경설정

- dockerDesktop → 환경설정 → kubernetes on
- **Kind 클러스터 요구사항:**
  - `kind-config.yaml`에 Ingress 설정 포함:
    ```yaml
    nodes:
      - role: control-plane
        kubeadmConfigPatches:
          - |
            kind: InitConfiguration
            nodeRegistration:
              kubeletExtraArgs:
                node-labels: "ingress-ready=true"
        extraPortMappings:
          - containerPort: 80
            hostPort: 8080 # localhost:8080으로 접근
            protocol: TCP
    ```
  - Nginx Ingress Controller 설치 (deploy.sh가 자동 설치)

### 유용한 디버깅 명령어

```bash
# 전체 리소스 확인
kubectl get all

# 파드 상태 상세 확인
kubectl describe pod <pod-name>

# 파드 로그 확인 (최근 100줄)
kubectl logs <pod-name> --tail=100

# 파드 실시간 로그
kubectl logs -f <pod-name>

# 레이블별 로그 확인
kubectl logs -l app=log-generator -f

# 이벤트 확인 (문제 진단)
kubectl get events --sort-by='.lastTimestamp'

# 리소스 사용량
kubectl top pods
```

---
