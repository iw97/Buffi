"use client";

import type { PaywallPlanId } from "@/lib/paywall/planIds";

export type { PaywallPlanId };

type TierDef = {
  id: PaywallPlanId;
  badge: string | null;
  badgeKind?: "popular" | "value";
  title: string;
  subtitle: string;
  featured: boolean;
  tone: "featured" | "standard" | "muted";
};

const TIERS: TierDef[] = [
  {
    id: "lifetime",
    badge: "Most popular",
    badgeKind: "popular",
    title: "Lifetime — $149",
    subtitle: "Pay once, use forever",
    featured: true,
    tone: "featured"
  },
  {
    id: "yearly",
    badge: "Best value",
    badgeKind: "value",
    title: "Yearly — $49.99/year",
    subtitle: "Best value — $4.17/month",
    featured: false,
    tone: "standard"
  },
  {
    id: "weekly",
    badge: null,
    title: "Weekly — $2.99/week",
    subtitle: "Cancel anytime",
    featured: false,
    tone: "muted"
  }
];

type Props = {
  onSelectPlan: (plan: PaywallPlanId) => void;
  /** Page uses full-width tier cards; modal uses compact spacing inside premium sheet */
  variant?: "page" | "modal";
};

export function PaywallTierList({ onSelectPlan, variant = "page" }: Props) {
  const rootClass = variant === "modal" ? "paywall-tiers paywall-tiers--modal" : "paywall-tiers";

  return (
    <div className={rootClass}>
      {TIERS.map((tier) => (
        <button
          key={tier.id}
          type="button"
          className={[
            "paywall-tier",
            tier.featured ? "paywall-tier--featured" : "",
            tier.tone === "muted" ? "paywall-tier--muted" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onSelectPlan(tier.id)}
        >
          {tier.badge ? (
            <span
              className={[
                "paywall-tier-badge",
                tier.badgeKind === "value" ? "paywall-tier-badge--value" : "paywall-tier-badge--popular"
              ].join(" ")}
            >
              {tier.badge}
            </span>
          ) : null}
          <span className="paywall-tier-title">{tier.title}</span>
          <span className="paywall-tier-sub">{tier.subtitle}</span>
        </button>
      ))}
    </div>
  );
}
