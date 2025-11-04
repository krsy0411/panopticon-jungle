"use client";

import { useState, useEffect } from "react";
import Shell from "../layout/Shell";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

// 더미 데이터
const DUMMY_STATS = {
  status_2xx: 1234,
  status_4xx: 25,
  status_5xx: 3,
  request_per_min: 450,
  p95_latency: 180,
};

// 시계열 더미 데이터 (최근 12시간, 1분 간격)
const generateTimeSeriesData = () => {
  const now = Date.now();
  const data = [];

  for (let i = 720; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 1000);
    data.push({
      time: timestamp.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      requests: Math.floor(Math.random() * 100) + 400,
      errors: Math.random() * 5,
      cpu: Math.random() * 30 + 40,
      memory: Math.random() * 20 + 60,
    });
  }

  return data.filter((_, i) => i % 60 === 0); // 1시간 간격만 표시
};

type MetricType = "requests" | "errors" | "resources";

export default function Dashboard() {
  const [stats, setStats] = useState(DUMMY_STATS);
  const [timeSeriesData] = useState(generateTimeSeriesData());
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("requests");

  // 실시간 업데이트 시뮬레이션 (WebSocket 대신)
  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        status_2xx: stats.status_2xx + Math.floor(Math.random() * 10),
        status_4xx: stats.status_4xx + Math.floor(Math.random() * 2),
        status_5xx: stats.status_5xx + Math.floor(Math.random() * 2),
        request_per_min: Math.floor(Math.random() * 100) + 400,
        p95_latency: Math.floor(Math.random() * 50) + 150,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [stats]);

  const renderChart = () => {
    switch (selectedMetric) {
      case "requests":
        return (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Request Rate (req/min)
            </h3>
            <div className="h-64 bg-gray-50 rounded flex items-end gap-1 px-4 py-2">
              {timeSeriesData.slice(-12).map((point, i) => (
                <div
                  key={i}
                  className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                  style={{
                    height: `${(point.requests / 600) * 100}%`,
                    minHeight: "4px",
                  }}
                  title={`${point.time}: ${point.requests} req/min`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
              <span>{timeSeriesData[0]?.time}</span>
              <span>{timeSeriesData[timeSeriesData.length - 1]?.time}</span>
            </div>
          </div>
        );

      case "errors":
        return (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Error Rate (%)
            </h3>
            <div className="h-64 bg-gray-50 rounded flex items-end gap-1 px-4 py-2">
              {timeSeriesData.slice(-12).map((point, i) => (
                <div
                  key={i}
                  className="flex-1 bg-red-500 rounded-t hover:bg-red-600 transition-colors cursor-pointer"
                  style={{
                    height: `${(point.errors / 10) * 100}%`,
                    minHeight: "4px",
                  }}
                  title={`${point.time}: ${point.errors.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
              <span>{timeSeriesData[0]?.time}</span>
              <span>{timeSeriesData[timeSeriesData.length - 1]?.time}</span>
            </div>
          </div>
        );

      case "resources":
        return (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              System Resources (%)
            </h3>
            <div className="h-64 bg-gray-50 rounded flex items-end gap-1 px-4 py-2">
              {timeSeriesData.slice(-12).map((point, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end gap-1">
                  <div
                    className="w-full bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-pointer"
                    style={{
                      height: `${(point.cpu / 100) * 256}px`,
                      minHeight: "4px",
                    }}
                    title={`CPU: ${point.cpu.toFixed(1)}%`}
                  />
                  <div
                    className="w-full bg-orange-500 rounded-t hover:bg-orange-600 transition-colors cursor-pointer"
                    style={{
                      height: `${(point.memory / 100) * 256}px`,
                      minHeight: "4px",
                    }}
                    title={`Memory: ${point.memory.toFixed(1)}%`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
              <span>{timeSeriesData[0]?.time}</span>
              <span>{timeSeriesData[timeSeriesData.length - 1]?.time}</span>
            </div>
            <div className="flex gap-6 mt-4 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-gray-700">CPU</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span className="text-gray-700">Memory</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Shell>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Real-time monitoring and SRE metrics
            </p>
          </div>
          <div className="text-xs text-gray-500">
            Last updated: {new Date().toLocaleTimeString("ko-KR")}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 2xx 성공 */}
          <Card className="p-4 border-l-4 border-l-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Success
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {stats.status_2xx.toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">2xx responses</p>
              </div>
            </div>
          </Card>

          {/* 4xx 클라이언트 에러 */}
          <Card className="p-4 border-l-4 border-l-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Client Errors
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {stats.status_4xx}
                </p>
                <p className="text-xs text-yellow-600 mt-1">4xx responses</p>
              </div>
            </div>
          </Card>

          {/* 5xx 서버 에러 */}
          <Card className="p-4 border-l-4 border-l-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Server Errors
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {stats.status_5xx}
                </p>
                <p className="text-xs text-red-600 mt-1">5xx responses</p>
              </div>
            </div>
          </Card>

          {/* Request/min */}
          <Card className="p-4 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Throughput
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {stats.request_per_min}
                </p>
                <p className="text-xs text-blue-600 mt-1">req/min</p>
              </div>
            </div>
          </Card>

          {/* P95 Latency */}
          <Card className="p-4 border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  P95 Latency
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {stats.p95_latency}
                </p>
                <p className="text-xs text-purple-600 mt-1">milliseconds</p>
              </div>
            </div>
          </Card>
        </div>

        {/* 시계열 그래프 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Time Series Metrics
            </h2>
            <div className="flex gap-2">
              <Button
                variant={selectedMetric === "requests" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMetric("requests")}
              >
                Request Rate
              </Button>
              <Button
                variant={selectedMetric === "errors" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMetric("errors")}
              >
                Error Rate
              </Button>
              <Button
                variant={selectedMetric === "resources" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMetric("resources")}
              >
                Resources
              </Button>
            </div>
          </div>

          {renderChart()}
        </Card>
      </div>
    </Shell>
  );
}
