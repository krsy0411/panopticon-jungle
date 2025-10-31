## 사용법

1. backend 폴더로 가서 docker image 생성
   1. `docker build -t log-generator:1.0 .`
2. k8s-log-generator 폴더로 가서 docker image 생성
   1. `docker build -t log-collector:1.0 .`
3. k8s 폴더에서 쿠버네티스로 배포
   1. `kubectl apply -f log-generator-deployment.yaml`
   2. `kubectl apply -f log-collector-deployment.yaml`
   3. `kubectl apply -f fluent-bit-config.yaml`
   4. `kubectl apply -f fluent-bit-daemonset.yaml`

4. `kubectl get pods` 로 기본적으로 7개 떠있으면 배포 성공.
5. `kubectl logs -f deploy/log-collector` 로 로그가 계속 생성된다면 정상작동

---

환경설정
dockerDesktop -> 환경설정 -> kubernetes on
