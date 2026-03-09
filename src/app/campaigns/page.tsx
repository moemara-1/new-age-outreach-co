"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  name: string;
  location: string;
  category: string;
  active: boolean;
  createdAt: string;
  _count: { leads: number };
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({ name: "", location: "", category: "" });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/campaigns").then((r) => r.json()).then(setCampaigns);
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure? This will delete all leads, sites, and emails for this campaign.")) return;
    setDeleting(id);
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } else {
      alert("Failed to delete campaign");
    }
    setDeleting(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.location || !form.category) return;
    setCreating(true);

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const campaign = await res.json();

    await fetch("/api/agents/scout/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: campaign.id,
        location: form.location,
        category: form.category,
      }),
    });

    setCampaigns((prev) => [{ ...campaign, _count: { leads: 0 } }, ...prev]);
    setForm({ name: "", location: "", category: "" });
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" className="text-[#888] hover:text-white transition-colors">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold">Campaigns</h1>
        </div>

        <form onSubmit={handleCreate} className="flex gap-3 mb-8">
          <input
            placeholder="Campaign name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-[#161616] rounded-lg px-4 py-2 text-sm flex-1 outline-none border border-[#222] focus:border-[#444]"
          />
          <input
            placeholder="Location (e.g. Amsterdam)"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="bg-[#161616] rounded-lg px-4 py-2 text-sm flex-1 outline-none border border-[#222] focus:border-[#444]"
          />
          <input
            placeholder="Category (e.g. restaurant)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="bg-[#161616] rounded-lg px-4 py-2 text-sm flex-1 outline-none border border-[#222] focus:border-[#444]"
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-white text-black rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {creating ? "Creating..." : "Launch"}
          </button>
        </form>

        <div className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="bg-[#111] rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <span className="font-semibold">{c.name}</span>
                <span className="text-[#666] text-sm ml-3">
                  {c.location} &middot; {c.category}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#999]">
                  {c._count.leads} leads
                </span>
                <span
                  title={c.active ? "Active" : "Inactive"}
                  className={`w-2 h-2 rounded-full ${c.active ? "bg-green-500" : "bg-[#666]"}`}
                />
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  className="text-red-500 text-sm hover:text-red-400 disabled:opacity-50 ml-2"
                >
                  {deleting === c.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <p className="text-[#555] text-sm text-center py-8">
              No campaigns yet. Create one above to start finding leads.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
