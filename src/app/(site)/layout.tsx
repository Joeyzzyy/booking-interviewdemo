import ScrollToTop from "@/components/ScrollToTop";

/** demo 站點外殼：極簡，無 header/footer */
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="flex-1 flex flex-col">{children}</main>
      <ScrollToTop />
    </>
  );
}
