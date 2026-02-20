"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gray-200/70 ${className}`}
      aria-hidden="true"
    />
  );
}
