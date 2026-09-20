export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 管理後台：獨立極簡 layout，不帶站點 header/footer
  return children;
}
