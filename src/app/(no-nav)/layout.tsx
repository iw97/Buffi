export default function NoNavLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className="app-shell">{children}</div>;
}

