import { BottomNav } from "@/components/navigation/BottomNav";

export default function NavLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="min-h-screen pb-[84px]">{children}</div>
      <BottomNav />
    </>
  );
}

