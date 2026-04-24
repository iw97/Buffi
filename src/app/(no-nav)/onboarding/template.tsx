export default function OnboardingTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="ob-page-enter">{children}</div>;
}
