"use client";

import { useState, useEffect } from "react";
import Shell from "../layout/Shell";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  ResponsiveContainer,
  LineChart as RLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

// // 더미 데이터
// const DUMMY_STATS = {
//   status_2xx: 1234,
//   status_4xx: 25,
//   status_5xx: 3,
//   request_per_min: 450,
//   p95_latency: 180,
// };

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

// API 응답 타입
type MetricsSummaryBucket = {
  timestamp: string;
  total: number;
  counts: Record<string, number>;
  // p95_latency?: number;
};

type MetricsSummaryResponse = {
  interval: string;
  timezone: string;
  buckets: MetricsSummaryBucket[];
};

// 상단 카드용 파생 타입
type MetricSummary = {
  status_2xx: number;
  status_4xx: number;
  status_5xx: number;
  request_per_min: number;
  // p95_latency: number | null;
};

const INITIAL_SUMMARY: MetricSummary = {
  status_2xx: 0,
  status_4xx: 0,
  status_5xx: 0,
  request_per_min: 0,
  // p95_latency: null,
};

// 최신 버킷에서 상단 카드 수치로 변환
function summarizeFromBucket(bucket: MetricsSummaryBucket): MetricSummary {
  const sumByPrefix = (prefix: string) =>
    Object.entries(bucket.counts || {}).reduce((acc, [code, cnt]) => {
      return code.startsWith(prefix) ? acc + (cnt || 0) : acc;
    }, 0);

  const status_2xx = sumByPrefix("2");
  const status_4xx = sumByPrefix("4");
  const status_5xx = sumByPrefix("5");

  const total =
    typeof bucket.total === "number"
      ? bucket.total
      : status_2xx + status_4xx + status_5xx;

  // interval=1h 기준 req/min
  const request_per_min = Math.round(total / 60);

  // const p95_latency = null;

  return { status_2xx, status_4xx, status_5xx, request_per_min };
}

export default function Dashboard() {
  const [liveStats, setLiveStats] = useState<MetricSummary>(INITIAL_SUMMARY);
  // const [stats, setStats] = useState(DUMMY_STATS);
  const [timeSeriesData] = useState(generateTimeSeriesData());
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("requests");

  useEffect(() => {
    let cancelled = false;

    const fetchSummary = async () => {
      try {
        const res = await fetch(`/api/metrics/summary`, { cache: "no-store" }); // 데이터 가져오기
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: MetricsSummaryResponse = await res.json(); // 데이터 파싱
        const last = json.buckets?.[json.buckets.length - 1];
        if (last && !cancelled) setLiveStats(summarizeFromBucket(last));
      } catch (err) {
        console.error("Failed to load metrics summary:", err);
      }
    };

    fetchSummary(); // 초기 로드
    const id = setInterval(fetchSummary, 30000); // 30초 폴링
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // // 실시간 업데이트 시뮬레이션 (WebSocket 대신)
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setStats({
  //       status_2xx: stats.status_2xx + Math.floor(Math.random() * 10),
  //       status_4xx: stats.status_4xx + Math.floor(Math.random() * 2),
  //       status_5xx: stats.status_5xx + Math.floor(Math.random() * 2),
  //       request_per_min: Math.floor(Math.random() * 100) + 400,
  //       p95_latency: Math.floor(Math.random() * 50) + 150,
  //     });
  //   }, 5000);

  //   return () => clearInterval(interval);
  // }, [stats]);

  const renderChart = () => {
    switch (selectedMetric) {
      case "requests":
        return (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Request Rate (req/min)
            </h3>
            <div className="bg-gray-50 rounded p-2">
              <ResponsiveContainer width="100%" height={256}>
                <RLineChart
                  data={timeSeriesData.slice(-12)}
                  margin={{ top: 8, right: 30, left: 16, bottom: 24 }} // bottom 늘림
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12, dy: 8 }}
                    interval={0} // 라벨 간격 균등 표시
                    minTickGap={20} // 라벨 겹침 방지
                  />
                  <YAxis domain={[0, "auto"]} />
                  <Tooltip
                    formatter={(v) => [
                      `${Math.round(Number(v))} req/min`,
                      "Requests",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                  />
                </RLineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case "errors":
        return (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Error Rate (%)
            </h3>
            <div className="bg-gray-50 rounded p-2">
              <ResponsiveContainer width="100%" height={256}>
                <RLineChart
                  data={timeSeriesData.slice(-12)}
                  margin={{ top: 8, right: 30, left: 16, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12, dy: 8 }}
                    interval={0}
                    minTickGap={20}
                  />
                  <YAxis domain={[0, "auto"]} />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, "Errors"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={false}
                  />
                </RLineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case "resources":
        return (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              System Resources (%)
            </h3>
            <div className="bg-gray-50 rounded p-2">
              <ResponsiveContainer width="100%" height={256}>
                <RLineChart
                  data={timeSeriesData.slice(-12)}
                  margin={{ top: 8, right: 30, left: 16, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12, dy: 8 }}
                    interval={0}
                    minTickGap={20}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(v, name) => [
                      `${Math.round(Number(v))}%`,
                      name === "cpu" ? "CPU" : "Memory",
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="memory"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                  />
                </RLineChart>
              </ResponsiveContainer>
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
              Real-time monitoring and metrics
            </p>
          </div>
          <div className="text-xs text-gray-500" suppressHydrationWarning>
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
                  {liveStats.status_2xx.toLocaleString()}
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
                  {liveStats.status_4xx}
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
                  {liveStats.status_5xx}
                </p>
                <p className="text-xs text-red-600 mt-1">5xx responses</p>
              </div>
            </div>
          </Card>

          {/* Request/min */}
          {/* <Card className="p-4 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Throughput
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {liveStats.request_per_min}
                </p>
                <p className="text-xs text-blue-600 mt-1">req/min</p>
              </div>
            </div>
          </Card> */}

          {/* P95 Latency
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
          </Card> */}
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
