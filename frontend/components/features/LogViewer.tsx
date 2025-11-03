"use client";

import { useState, useEffect } from "react";
import Shell from "../layout/Shell";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Search, RefreshCw, X } from "lucide-react";

// 로그 타입 정의
interface Log {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  service: string;
  message: string;
  details: Record<string, unknown>;
}

// 더미 로그 데이터 생성
const generateDummyLogs = (): Log[] => {
  const levels: Log["level"][] = ["INFO", "WARN", "ERROR"];
  const services = [
    "payment-api",
    "user-service",
    "inventory-api",
    "log-generator-server",
  ];
  const messages = [
    "user fetch started",
    "user fetch completed",
    "DB connection lost",
    "retry successful",
    "payment processing started",
    "payment completed",
    "slow query detected",
    "cache miss",
    "authentication successful",
    "checkout completed",
  ];

  const logs: Log[] = [];
  const now = Date.now();

  for (let i = 0; i < 500; i++) {
    const timestamp = new Date(now - i * 1000);
    const level = levels[Math.floor(Math.random() * levels.length)];
    const service = services[Math.floor(Math.random() * services.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];

    logs.push({
      id: `log-${i}`,
      timestamp: timestamp.toISOString(),
      level,
      service,
      message,
      details: {
        "@timestamp": timestamp.toISOString(),
        service,
        level,
        message,
        module: "UserAPI",
        action: "getUserById",
        userId: Math.floor(Math.random() * 1000),
        latency: Math.floor(Math.random() * 200),
        trace_id: `trace-${Math.random().toString(36).substring(2, 9)}`,
        host: `pod-${Math.floor(Math.random() * 5)}`,
      },
    });
  }

  return logs;
};

export default function LogViewer() {
  const [allLogs] = useState<Log[]>(generateDummyLogs());
  const [filteredLogs, setFilteredLogs] = useState<Log[]>(allLogs);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    level: "all",
    service: "all",
  });

  // 필터 적용
  useEffect(() => {
    let result = allLogs;

    if (filters.level !== "all") {
      result = result.filter((log) => log.level === filters.level);
    }

    if (filters.service !== "all") {
      result = result.filter((log) => log.service === filters.service);
    }

    if (filters.search) {
      result = result.filter((log) =>
        log.message.toLowerCase().includes(filters.search.toLowerCase()),
      );
    }

    setFilteredLogs(result);
  }, [filters, allLogs]);

  // 레벨별 색상
  const getLevelColor = (level: Log["level"]) => {
    switch (level) {
      case "ERROR":
        return "bg-red-100 text-red-700 border-red-200";
      case "WARN":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "INFO":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getLevelDot = (level: Log["level"]) => {
    switch (level) {
      case "ERROR":
        return "bg-red-500";
      case "WARN":
        return "bg-yellow-500";
      case "INFO":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <Shell>
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Logs</h1>
            <p className="text-sm text-gray-500 mt-1">
              Real-time log streaming and analysis
            </p>
          </div>
          <div className="text-xs text-gray-500">
            {filteredLogs.length} logs
          </div>
        </div>

        {/* 상단 필터 */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Search logs..."
                className="pl-9"
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            <Select
              value={filters.service}
              onValueChange={(value) =>
                setFilters({ ...filters, service: value })
              }
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="payment-api">payment-api</SelectItem>
                <SelectItem value="user-service">user-service</SelectItem>
                <SelectItem value="inventory-api">inventory-api</SelectItem>
                <SelectItem value="log-generator-server">
                  log-generator-server
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.level}
              onValueChange={(value) =>
                setFilters({ ...filters, level: value })
              }
            >
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
                <SelectItem value="WARN">WARN</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full md:w-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </Card>

        {/* 로그 리스트 */}
        <Card className="p-0 overflow-hidden">
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p className="text-sm">No logs found</p>
                <p className="text-xs mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-40">Timestamp</th>
                    <th className="py-3 px-4 w-20">Level</th>
                    <th className="py-3 px-4 w-40">Service</th>
                    <th className="py-3 px-4">Message</th>
                    <th className="py-3 px-4 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                        {new Date(log.timestamp).toLocaleString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${getLevelDot(log.level)}`}
                          ></div>
                          <span
                            className={`text-xs font-medium ${
                              log.level === "ERROR"
                                ? "text-red-700"
                                : log.level === "WARN"
                                  ? "text-yellow-700"
                                  : "text-blue-700"
                            }`}
                          >
                            {log.level}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-mono text-xs">
                        {log.service}
                      </td>
                      <td className="py-3 px-4 text-gray-900">{log.message}</td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="ghost" className="text-xs">
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* 상세 로그 다이얼로그 */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Log Details</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            {selectedLog && (
              <div className="space-y-6">
                {/* 메타데이터 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">
                      Timestamp
                    </p>
                    <p className="text-sm font-mono text-gray-900">
                      {new Date(selectedLog.timestamp).toISOString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Level</p>
                    <Badge className={getLevelColor(selectedLog.level)}>
                      {selectedLog.level}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Service</p>
                    <p className="text-sm font-mono text-gray-900">
                      {selectedLog.service}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">
                      Trace ID
                    </p>
                    <p className="text-sm font-mono text-blue-600">
                      {(selectedLog.details as { trace_id?: string })
                        .trace_id || "N/A"}
                    </p>
                  </div>
                </div>

                {/* 메시지 */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Message</p>
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <p className="text-sm text-gray-900 font-mono">
                      {selectedLog.message}
                    </p>
                  </div>
                </div>

                {/* JSON 상세 */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">
                    Full Details (JSON)
                  </p>
                  <pre className="text-xs p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto font-mono leading-relaxed">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Shell>
  );
}
