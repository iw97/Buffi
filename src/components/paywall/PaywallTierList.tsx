"use client";

import type { PaywallPlanId } from "@/lib/paywall/planIds";

export type { PaywallPlanId };

type TierDef = {
  id: PaywallPlanId;
  badge: string | null;
  badgeKind?: "launch";
  title: string;
  subtitle: string;
  inlineLabel?: string;
  featured: boolean;
  tone: "featured" | "standard" | "muted";
  launchPricing?: {
    originalPrice: string;
    currentPrice: string;
    note: string;
  };
};

const TIERS: TierDef[] = [
  {
    id: "lifetime",
    badge: "Launch pricing",
    badgeKind: "launch",
    title: "Lifetime",
    subtitle: "Pay once, use forever",
    featured: false,
    tone: "standard",
    launchPricing: {
      originalPrice: "$149",
      currentPrice: "$99",
      note: "Limited time offer"
    }
  },
  {
    id: "yearly",
    badge: null,
    title: "Yearly — $49.99/year",
    subtitle: "$4.17/month",
    inlineLabel: "Best value",
    featured: true,
    tone: "featured"
  },
  {
    id: "weekly",
    badge: null,
    title: "Weekly — $3.99/week",
    subtitle: "Cancel anytime",
    featured: false,
    tone: "standard"
  }
];

type Props = {
  onSelectPlan: (plan: PaywallPlanId) => void;
  /** Page uses full-width tier cards; modal uses compact spacing inside premium sheet */
  variant?: "page" | "modal";
  disabled?: boolean;
  /** When set, only show these plan cards (e.g. lifetime upgrade for existing subscribers). */
  onlyPlans?: PaywallPlanId[];
};

export function PaywallTierList({
  onSelectPlan,
  variant = "page",
  disabled = false,
  onlyPlans
}: Props) {
  const rootClass = variant === "modal" ? "paywall-tiers paywall-tiers--modal" : "paywall-tiers";
  const tiers = onlyPlans ? TIERS.filter((t) => onlyPlans.includes(t.id)) : TIERS;

  return (
    <div className={rootClass}>
      {tiers.map((tier) => (
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
            <span className="paywall-tier-badge paywall-tier-badge--launch">{tier.badge}</span>
          ) : null}
          {tier.launchPricing ? (
            <>
              <span className="paywall-tier-title paywall-tier-title--with-launch">{tier.title}</span>
              <span className="paywall-tier-price-line">
                <span className="paywall-tier-price-original">{tier.launchPricing.originalPrice}</span>
                <span className="paywall-tier-price-current">{tier.launchPricing.currentPrice}</span>
              </span>
              <span className="paywall-tier-sub">{tier.subtitle}</span>
              <span className="paywall-tier-launch-note">{tier.launchPricing.note}</span>
            </>
          ) : (
            <>
              <span className="paywall-tier-title">{tier.title}</span>
              {tier.inlineLabel ? (
                <span className="paywall-tier-inline-label">{tier.inlineLabel}</span>
              ) : null}
              <span className="paywall-tier-sub">{tier.subtitle}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
