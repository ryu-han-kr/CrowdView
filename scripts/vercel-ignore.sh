#!/bin/bash
# Vercel 빌드 건너뛰기 판단 (vercel.json ignoreCommand). exit 0 = 건너뜀, exit 1 = 빌드
# - Preview 배포는 건너뛴다: PR마다 GitHub CI가 따로 빌드·화면 시험을 하고, 빌드가 Vercel 사용량의 2/3였다 (10/15~20 빌드 27시간)
# - 운영도 문서·참고 사진만 바뀌었으면 건너뛴다
if [ "$VERCEL_ENV" != "production" ]; then
  echo "Preview 배포 건너뜀"
  exit 0
fi
if git diff --quiet HEAD^ HEAD -- . ':(exclude)docs' ':(exclude)*.md' ':(exclude)photo'; then
  echo "문서만 바뀜 → 건너뜀"
  exit 0
fi
exit 1
