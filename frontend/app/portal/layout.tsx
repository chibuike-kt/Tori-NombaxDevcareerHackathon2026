import { Suspense } from "react";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#FAFAF8" }}
        >
          <div className="text-sm font-medium" style={{ color: "#8A94A6" }}>
            Loading...
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
