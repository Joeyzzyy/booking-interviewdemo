import type { Metadata } from "next";
import { Suspense } from "react";
import AdminShell from "./AdminShell";

export const metadata: Metadata = {
  title: "管理後台",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <Suspense>
      <AdminShell />
    </Suspense>
  );
}
