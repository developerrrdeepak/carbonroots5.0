import { PublicStats } from "@shared/site";

export async function fetchPublicStats(): Promise<PublicStats> {
  const res = await fetch("/api/public/stats");
  if (!res.ok) throw new Error("Failed to load stats");
  const json = await res.json();
  return json.stats as PublicStats;
}

export async function savePublicStats(data: Partial<PublicStats>, token: string): Promise<PublicStats> {
  const res = await fetch("/api/admin/stats", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.stats as PublicStats;
}
