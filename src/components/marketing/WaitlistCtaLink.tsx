"use client";

import Link from "next/link";
import { WAITLIST_PAGE_PATH } from "@/lib/waitlist";

type Props = {
  className: string;
  children: React.ReactNode;
};

/** All CTAs go to the in-app waitlist page (embedded form when URL is configured). */
export function WaitlistCtaLink({ className, children }: Props) {
  return (
    <Link href={WAITLIST_PAGE_PATH} className={className}>
      {children}
    </Link>
  );
}
