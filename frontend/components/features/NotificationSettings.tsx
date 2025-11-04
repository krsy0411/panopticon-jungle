"use client";

import { useState } from "react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { Mail, MessageSquare } from "lucide-react";

export default function NotificationSettings() {
  const [slackEnabled, setSlackEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1 text-2xl font-semibold">알림 설정</h1>
        <p className="text-gray-500">에러 이벤트를 받을 채널을 설정합니다.</p>
      </div>

      {/* ------------------------------ */}
      {/* 🟣 알림 채널 설정 */}
      {/* ------------------------------ */}
      <div className="space-y-6">
        {/* Slack */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-gray-900">Slack 연동</h3>
                <p className="text-gray-500 text-sm">
                  Slack 채널로 알림을 전송합니다.
                </p>
              </div>
            </div>
            <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
          </div>

          {slackEnabled && (
            <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
              <div>
                <Label>Slack Webhook URL</Label>
                <Input
                  placeholder="https://hooks.slack.com/services/..."
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>기본 채널</Label>
                  <Input placeholder="#sre-alerts" className="mt-1.5" />
                </div>
                <div>
                  <Label>긴급 알림 채널</Label>
                  <Input placeholder="#critical-alerts" className="mt-1.5" />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Email */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-gray-900">이메일 알림</h3>
                <p className="text-gray-500 text-sm">
                  지정된 이메일 주소로 알림을 전송합니다.
                </p>
              </div>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>

          {emailEnabled && (
            <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
              <div>
                <Label>수신 이메일(쉼표로 구분)</Label>
                <Textarea
                  placeholder="sre@company.com, ops@company.com"
                  className="mt-1.5"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>발신자 이름</Label>
                  <Input placeholder="Panopticon" className="mt-1.5" />
                </div>
                <div>
                  <Label>발신 주소</Label>
                  <Input placeholder="noreply@company.com" className="mt-1.5" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch id="email-digest" />
                  <Label htmlFor="email-digest" className="cursor-pointer">
                    매일 요약 이메일
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="email-urgent" defaultChecked />
                  <Label htmlFor="email-urgent" className="cursor-pointer">
                    긴급 알림만
                  </Label>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
