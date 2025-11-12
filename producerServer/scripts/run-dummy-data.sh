#!/bin/bash

# 더미 데이터 전송 스크립트 실행

echo "🚀 Starting dummy data generation script..."

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# TypeScript 파일을 직접 실행
npx tsx scripts/send-dummy-data.ts

echo "✅ Done!"
