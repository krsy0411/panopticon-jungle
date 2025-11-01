"use client";

import Shell from "../layout/Shell";

// ======================================
// ② 메인 컴포넌트
// ======================================
export default function Dashboard() {
  return (
    <Shell>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-gray-900 mb-1 text-2xl font-semibold">
              대시보드
            </h1>
            <p className="text-gray-500">실시간 서비스 모니터링 및 SRE 지표</p>
          </div>
        </div>
      </div>
      <div>
        <div>
          <p>Main Content</p>
        </div>
      </div>
    </Shell>
  );
}
