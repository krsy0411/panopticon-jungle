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
            <span className="text-blue-600">Panopticon</span>
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
          <span className="text-sm">모니터링부터 복구까지, 운영 자동화를 한 곳에서</span>
        </div>

        <h1 className="text-gray-900 mb-6 max-w-4xl mx-auto">
          운영자는 알림만 확인하면 됩니다
          <br />
         나머지는 Panopticon이 처리합니다
        </h1>

        <p className="text-gray-600 text-xl mb-8 max-w-2xl mx-auto">
          로그와 메트릭 데이터를 실시간으로 분석해 이상을 감지하면,
          <br />
          즉시 알림을 전송하고 자동으로 복구합니다
        </p>
      </section>
    </div>
  );
}
