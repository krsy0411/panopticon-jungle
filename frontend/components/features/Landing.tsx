"use client";

import { Button } from "../ui/button";
import { Activity, Zap } from "lucide-react";

interface LandingProps {
  onLoginClick: () => void;
}

export default function Landing({ onLoginClick }: LandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            <span className="text-blue-600">SRE Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost">제품</Button>
            <Button variant="ghost">가격</Button>
            <Button variant="ghost">문서</Button>
            <Button variant="outline" onClick={onLoginClick}>
              로그인
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full mb-6">
          <Zap className="w-4 h-4" />
          <span className="text-sm">AI 기반 자동화 SRE 플랫폼</span>
        </div>

        <h1 className="text-gray-900 mb-6 max-w-4xl mx-auto">
          운영 자동화의 새로운 기준,
          <br />
          LLM과 K8s가 만나다
        </h1>

        <p className="text-gray-600 text-xl mb-8 max-w-2xl mx-auto">
          메트릭과 로그를 실시간으로 분석하고, AI가 제안하는 최적의 조치로
          <br />
          시스템 안정성을 자동으로 유지하세요.
        </p>
      </section>
    </div>
  );
}
