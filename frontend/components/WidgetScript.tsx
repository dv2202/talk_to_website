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
          src="/api/widget/widget.js"
          data-bot="talktowebsite-help"
          data-api-key="ttw_e0b23312c871f39799e4a2bdfc1c0620f2325dec6927fa89"
        />
      )}
    </>
  );
}
