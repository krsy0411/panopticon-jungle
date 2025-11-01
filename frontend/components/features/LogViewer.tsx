"use client";

import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Search, Download, RefreshCw } from "lucide-react";

export default function LogViewer() {
  return (
    <div className="space-y-6">
      {/* 🔹 상단 필터/검색 바 */}
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input placeholder="검색어를 입력하세요" className="pl-8" />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          </div>

          <Select defaultValue="all">
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              <SelectItem value="payment-api">payment-api</SelectItem>
              <SelectItem value="user-service">user-service</SelectItem>
              <SelectItem value="inventory-api">inventory-api</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            다운로드
          </Button>
        </div>
      </Card>

      {/* 🔹 로그 테이블 (데이터 없이 구조만) */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-gray-600">
              <th className="py-2 px-3 text-left w-40">시간</th>
              <th className="py-2 px-3 text-left w-20">레벨</th>
              <th className="py-2 px-3 text-left w-40">서비스</th>
              <th className="py-2 px-3 text-left">메시지</th>
              <th className="py-2 px-3 text-right w-12">보기</th>
            </tr>
          </thead>
          <tbody>
            {/* 더미 한 줄만 (레이아웃 확인용) */}
            <tr className="border-t">
              <td className="py-2 px-3 text-gray-500">2025-11-01 12:00:00</td>
              <td className="py-2 px-3">
                <Badge variant="outline">INFO</Badge>
              </td>
              <td className="py-2 px-3">user-service</td>
              <td className="py-2 px-3 text-gray-600">
                로그 예시 메시지입니다.
              </td>
              <td className="py-2 px-3 text-right">
                <Button size="sm" variant="ghost">
                  상세
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
