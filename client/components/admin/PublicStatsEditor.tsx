import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PublicStats } from "@shared/site";

export default function PublicStatsEditor() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/stats");
        if (!res.ok) throw new Error("load failed");
        const j = await res.json();
        setStats(j.stats);
      } catch (e) {
        toast.error("Failed to load stats");
      }
    })();
  }, []);

  const save = async () => {
    if (!stats) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch("/api/admin/stats", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(stats),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setStats(j.stats);
      (window as any).__publicStats = j.stats;
      toast.success("Saved");
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!stats) return <p className="text-sm text-gray-600">Loading...</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label>Active Sensors</Label>
        <Input
          type="number"
          value={stats.activeSensors}
          onChange={(e) => setStats({ ...stats, activeSensors: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label>Total Farmers</Label>
        <Input
          type="number"
          value={stats.totalFarmers}
          onChange={(e) => setStats({ ...stats, totalFarmers: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label>Total Income (INR)</Label>
        <Input
          type="number"
          value={stats.totalIncomeINR}
          onChange={(e) => setStats({ ...stats, totalIncomeINR: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label>Languages Supported</Label>
        <Input
          type="number"
          value={stats.languagesSupported}
          onChange={(e) => setStats({ ...stats, languagesSupported: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label>Support Label</Label>
        <Input
          value={stats.supportLabel}
          onChange={(e) => setStats({ ...stats, supportLabel: e.target.value })}
        />
      </div>
      <div className="md:col-span-2">
        <Button onClick={save} disabled={saving} className="w-full md:w-auto">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
