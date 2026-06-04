import { OnboardingPageTransition } from "@/components/onboarding/OnboardingPageTransition";

export default function OnboardingTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnboardingPageTransition>{children}</OnboardingPageTransition>;
}
