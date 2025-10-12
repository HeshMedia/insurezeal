import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DocumentStore } from "@/types/profile.types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency with Indian Rupee symbol
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

// Format date to readable format
export function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

// Format date with time
export function formatDateTime(dateString: string | Date): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Format number with commas
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}

const prettifyDocumentLabel = (label: string): string =>
  label
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Document";

type DocumentCandidate = {
  document_type?: string | null;
  document_name?: string | null;
  url?: string | null;
  document_url?: string | null;
  file_url?: string | null;
  [key: string]: unknown;
};

export interface NormalizedDocumentLink {
  label: string;
  url: string;
}

export const normalizeDocumentUrls = (
  store?: DocumentStore | null,
): NormalizedDocumentLink[] => {
  if (!store) return [];

  const normalized: NormalizedDocumentLink[] = [];

  const pushIfValid = (labelSource: string | null | undefined, urlCandidate: unknown) => {
    if (typeof urlCandidate !== "string") return;
    const trimmed = urlCandidate.trim();
    if (!trimmed) return;
    normalized.push({
      label: prettifyDocumentLabel(labelSource ?? "Document"),
      url: trimmed,
    });
  };

  if (Array.isArray(store)) {
    store.forEach((entry) => {
      if (!entry) return;
      const candidate = entry as DocumentCandidate;
      const url = candidate.url ?? candidate.document_url ?? candidate.file_url;
      const label = candidate.document_name ?? candidate.document_type ?? undefined;
      pushIfValid(label, url);
    });
    return normalized;
  }

  Object.entries(store).forEach(([key, value]) => {
    if (!value) return;

    if (typeof value === "string") {
      pushIfValid(key, value);
      return;
    }

    if (typeof value === "object") {
      const candidate = value as DocumentCandidate;
      const url = candidate.url ?? candidate.document_url ?? candidate.file_url;
      const label = candidate.document_name ?? candidate.document_type ?? key;
      pushIfValid(label ?? key, url);
    }
  });

  return normalized;
};
