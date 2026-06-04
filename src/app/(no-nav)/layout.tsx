export default function NoNavLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className="app-shell app-shell--no-nav">{children}</div>;
}

