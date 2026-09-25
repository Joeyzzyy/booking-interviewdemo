import SiteHeader from "@/components/brand/SiteHeader";
import ScrollToTop from "@/components/ScrollToTop";

/** 站點外殼：統一頂部導航 */
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col pt-[64px]">{children}</main>
      <ScrollToTop />
    </>
  );
}
