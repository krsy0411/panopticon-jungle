"use client";

import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Select, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Plus, Save } from 'lucide-react';

export default function SLOSettings() {
  return (
    <div className="p-8 max-w-7xl">
      {/* 페이지 타이틀 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1 text-2xl font-semibold">SLO 설정</h1>
        <p className="text-gray-500">
          서비스 레벨 목표(Service Level Objective)를 정의하고 관리합니다.
        </p>
      </div>

      {/* 새 SLO 추가 섹션 */}
      <Card className="p-6 mb-6">
        <h3 className="text-gray-900 mb-4">새 SLO 추가</h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <Label>서비스명</Label>
            <Input placeholder="예: payment-api" className="mt-1.5" />
          </div>

          <div>
            <Label>측정 지표</Label>
            <Select>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Latency" />
              </SelectTrigger>
            </Select>
          </div>

          <div>
            <Label>임계값 (ms)</Label>
            <Input type="number" className="mt-1.5" />
          </div>

          <div>
            <Label>백분위수 (P)</Label>
            <Select>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="P95" />
              </SelectTrigger>
            </Select>
          </div>

          <div>
            <Label>가용성 목표 (%)</Label>
            <Input type="number" step="0.1" className="mt-1.5" />
          </div>
        </div>

        <Button className="w-full">
          <Plus className="w-4 h-4 mr-2" /> 새 SLO 추가
        </Button>
      </Card>

      {/* SLO 목록 섹션 (빈 상태) */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-900">설정된 SLO 목록</h3>
          <Badge>0개 서비스</Badge>
        </div>

        {/* 데이터 없는 상태 문구 */}
        <div className="text-center text-gray-500 py-8 border border-dashed border-gray-200 rounded-lg">
          등록된 SLO가 없습니다.
        </div>

        <div className="mt-6 flex gap-2">
          <Button className="flex-1">
            <Save className="w-4 h-4 mr-2" /> 모든 변경사항 저장
          </Button>
          <Button variant="outline">취소</Button>
        </div>
      </Card>
    </div>
  );
}