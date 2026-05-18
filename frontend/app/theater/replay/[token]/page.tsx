/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc Öffentliche Replay-Page für Decision-Theater-Snapshots mit OpenGraph-Metadaten
 */

import type { Metadata } from "next";
import type { ComponentType } from "react";
import TheaterReplayPageComponent from "@/components/theater/theater-replay-page";
import { notFound } from "next/navigation";

type ReplayRouteParams = {
  token: string;
};

type ReplaySnapshot = Record<string, unknown> & {
  title?: string;
  description?: string;
  summary?: string;
  ogImage?: string;
  metadata?: {
    title?: string;
    description?: string;
    summary?: string;
    ogImage?: string;
    image?: string;
  };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
const TheaterReplayPage = TheaterReplayPageComponent as ComponentType<{ snapshot: ReplaySnapshot }>;

function getSnapshotTitle(snapshot: ReplaySnapshot): string {
  const metadata = snapshot.metadata;
  return metadata?.title ?? snapshot.title ?? "Decision Theater Replay";
}

function getSnapshotDescription(snapshot: ReplaySnapshot): string {
  const metadata = snapshot.metadata;
  return metadata?.description ?? metadata?.summary ?? snapshot.description ?? snapshot.summary ?? "Redacted KI-OS Decision Theater replay.";
}

function getSnapshotImage(snapshot: ReplaySnapshot): string | undefined {
  const metadata = snapshot.metadata;
  return metadata?.ogImage ?? metadata?.image ?? snapshot.ogImage;
}

async function fetchSnapshot(token: string): Promise<ReplaySnapshot | null> {
  try {
    const response = await fetch(`${APP_URL}/api/theater/replay/${token}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    return data as ReplaySnapshot;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<ReplayRouteParams> },
): Promise<Metadata> {
  const { token } = await params;
  const snapshot = await fetchSnapshot(token);

  if (!snapshot) {
    return {
      title: "Replay not found",
      robots: { index: false, follow: false },
    };
  }

  const title = getSnapshotTitle(snapshot);
  const description = getSnapshotDescription(snapshot);
  const image = getSnapshotImage(snapshot);
  const url = `${APP_URL}/theater/replay/${token}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function TheaterReplayRoute(
  { params }: { params: Promise<ReplayRouteParams> },
) {
  const { token } = await params;
  const snapshot = await fetchSnapshot(token);

  if (!snapshot) {
    notFound();
  }

  return <TheaterReplayPage snapshot={snapshot} />;
}
