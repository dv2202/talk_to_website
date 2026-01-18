"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function WidgetScript() {
  const pathname = usePathname();

  // Hide the widget on /dashboard and any nested routes like /dashboard/example
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname.startsWith("/bot/");

  // We want to load the script if the user visits a non-dashboard page.
  // Once loaded, we keep the script tag to avoid multiple script evaluation/network calls,
  // but use CSS to hide/show the widget itself.
  const [shouldLoad, setShouldLoad] = useState(!isDashboard);

  useEffect(() => {
    if (!isDashboard) {
      setShouldLoad(true);
    }
  }, [isDashboard]);

  return (
    <>
      {isDashboard && (
        <style>{`
          #ttw-widget-host {
            display: none !important;
          }
        `}</style>
      )}
      {shouldLoad && (
        <script
          src={`${process.env.NEXT_PUBLIC_APP_URL}/api/widget/widget.js`}
          data-bot="bot-web-ai"
          data-api-key="ttw_0b5fbc1e3a468fb6bb8d2719d048fe8791b7495afa765573"
        />
      )}
    </>
  );
}
