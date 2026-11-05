import type { Metadata } from "next";

import { ApplicationForm } from "@/components/apply/ApplicationForm";
import { PolicyGuide } from "@/components/apply/PolicyGuide";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "New assessment" };

export default function ApplyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="New assessment"
        title="Enter the applicant's financial details"
        description="Verity's server scores the three values with its demonstration policy and explains how each one shaped the result."
      />
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <ApplicationForm />
        <PolicyGuide />
      </div>
    </div>
  );
}
