/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc Geschützte Gallery-Page für öffentliche Decision-Theater-Runs
 */

import Link from "next/link";

type GalleryItem = {
  id?: string;
  runId?: string;
  token?: string;
  shareToken?: string;
  title?: string;
  name?: string;
  description?: string;
  summary?: string;
  tags?: string[];
  stars?: number;
  starCount?: number;
  views?: number;
  viewCount?: number;
};

type GalleryResponse = {
  items?: GalleryItem[];
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getItemTitle(item: GalleryItem): string {
  return asText(item.title) ?? asText(item.name) ?? "Untitled Theater Run";
}

function getItemSummary(item: GalleryItem): string {
  return asText(item.description) ?? asText(item.summary) ?? "Shared decision replay from the KI-OS theater gallery.";
}

function getItemTags(item: GalleryItem): string[] {
  return Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0) : [];
}

function getItemToken(item: GalleryItem): string | null {
  return asText(item.shareToken) ?? asText(item.token);
}

function getItemId(item: GalleryItem, index: number): string {
  return asText(item.id) ?? asText(item.runId) ?? getItemToken(item) ?? `gallery-item-${index}`;
}

async function fetchGallery(): Promise<GalleryItem[]> {
  try {
    const response = await fetch(`${APP_URL}/api/theater/gallery?limit=20&offset=0`, { cache: "no-store" });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    const items = (data as GalleryResponse)?.items;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export default async function TheaterGalleryPage() {
  const items = await fetchGallery();

  return (
    <div className="space-y-6">
      <section
        className="rounded-[24px] border border-white/10 bg-black/20 p-6 backdrop-blur"
        style={{
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div
              className="inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)",
                color: "var(--accent)",
              }}
            >
              Decision Theater
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em]">Public replay gallery</h1>
            <p className="max-w-3xl text-sm" style={{ color: "var(--muted-foreground)" }}>
              Browse shared theater runs, review engagement, and jump into replay links without leaving Orbit Control.
            </p>
          </div>
          <Link
            href="/theater/share"
            className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90"
            style={{
              backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
              color: "var(--accent)",
            }}
          >
            Share this run
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => {
          const itemId = getItemId(item, index);
          const title = getItemTitle(item);
          const summary = getItemSummary(item);
          const tags = getItemTags(item);
          const stars = asNumber(item.stars) || asNumber(item.starCount);
          const views = asNumber(item.views) || asNumber(item.viewCount);
          const token = getItemToken(item);
          const replayHref = token ? `/theater/replay/${token}` : "/theater/share";

          return (
            <article
              key={itemId}
              className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur"
              style={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold leading-tight">{title}</h2>
                  <p className="text-sm leading-6" style={{ color: "var(--muted-foreground)" }}>
                    {summary}
                  </p>
                </div>
                <div
                  className="shrink-0 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em]"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  public
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {tags.length > 0 ? (
                  tags.map((tag) => (
                    <span
                      key={`${itemId}-${tag}`}
                      className="rounded-full px-3 py-1 text-[11px]"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--foreground) 7%, transparent)",
                        color: "var(--foreground)",
                        border: "1px solid color-mix(in srgb, var(--border) 75%, transparent)",
                      }}
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span
                    className="rounded-full px-3 py-1 text-[11px]"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--foreground) 7%, transparent)",
                      color: "var(--muted-foreground)",
                      border: "1px solid color-mix(in srgb, var(--border) 75%, transparent)",
                    }}
                  >
                    no tags
                  </span>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div
                  className="rounded-2xl p-3"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--foreground) 5%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--border) 75%, transparent)",
                  }}
                >
                  <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted-foreground)" }}>
                    Stars
                  </div>
                  <div className="mt-1 text-xl font-semibold">{stars}</div>
                </div>
                <div
                  className="rounded-2xl p-3"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--foreground) 5%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--border) 75%, transparent)",
                  }}
                >
                  <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted-foreground)" }}>
                    Views
                  </div>
                  <div className="mt-1 text-xl font-semibold">{views}</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={replayHref}
                  className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
                    color: "var(--accent)",
                  }}
                >
                  Open replay
                </Link>
                <Link
                  href="/theater/share"
                  className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90"
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid color-mix(in srgb, var(--border) 85%, transparent)",
                    color: "var(--foreground)",
                  }}
                >
                  Share this run
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      {items.length === 0 ? (
        <section
          className="rounded-[24px] border border-white/10 bg-black/20 p-6 text-sm backdrop-blur"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--muted-foreground)",
          }}
        >
          No public theater runs available yet.
        </section>
      ) : null}
    </div>
  );
}
