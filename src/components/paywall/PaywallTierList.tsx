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
    badge: null,
    title: "Lifetime — $149",
    subtitle: "Pay once, use forever",
    featured: false,
    tone: "standard"
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
    badge: "Most popular",
    badgeKind: "popular",
    title: "Weekly — $3.99/week",
    subtitle: "Cancel anytime",
    featured: true,
    tone: "featured"
  }
];

type Props = {
  onSelectPlan: (plan: PaywallPlanId) => void;
  /** Page uses full-width tier cards; modal uses compact spacing inside premium sheet */
  variant?: "page" | "modal";
  disabled?: boolean;
};

export function PaywallTierList({ onSelectPlan, variant = "page", disabled = false }: Props) {
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
          disabled={disabled}
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
