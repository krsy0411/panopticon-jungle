"use client";

import { useRouter } from "next/navigation";
import Shell from "../layout/Shell";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

type Item = { id: string; name: string; modified: string; popularity: number };

const ITEMS: Item[] = [
  {
    id: "system-metrics",
    name: "System - Metrics",
    modified: "Nov 3, 8:51 pm",
    popularity: 78,
  },
];

function PopularityBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-32 rounded-full bg-gray-200">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-purple-400"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export default function DashboardList() {
  const router = useRouter();
  return (
    <Shell>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">All Dashboards</h2>
            <p className="text-sm text-muted-foreground">
              {ITEMS.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">Edit Teams</Button>
            <Button variant="outline">Add to</Button>
            <Button variant="destructive">Delete</Button>
          </div>
        </div>

        <div className="mt-4 border rounded-md overflow-hidden">
          <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 border-b">
            <div>Name</div>
            <div>Modified</div>
            <div>Popularity</div>
          </div>
          <div className="divide-y">
            {ITEMS.map((it) => (
              <button
                key={it.id}
                onClick={() => router.push(`/dashboard/${it.id}`)}
                className="w-full text-left"
              >
                <div className="grid grid-cols-3 gap-4 px-4 py-3 hover:bg-gray-50">
                  <div className="truncate">{it.name}</div>
                  <div className="text-muted-foreground">{it.modified}</div>
                  <div className="flex items-center">
                    <PopularityBar value={it.popularity} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </Shell>
  );
}
