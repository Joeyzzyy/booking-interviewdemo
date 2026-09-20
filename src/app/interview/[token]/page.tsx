import type { Metadata } from "next";
import InterviewClient from "./InterviewClient";

export const metadata: Metadata = {
  title: "視頻面試",
  robots: { index: false, follow: false },
};

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InterviewClient token={token} />;
}
