import type { Metadata } from "next";

import { ResultView } from "@/components/results/ResultView";

export const metadata: Metadata = { title: "Decision result" };

/** The result is fetched from GET /api/applications/[id] — never calculated in the browser. */
export default async function ApplicationResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultView id={id} />;
}
