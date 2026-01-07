import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

const DISALLOW_PATHS = [
  "/dashboard/",
  "/admin/",
  "/api/",
  "/login",
  "/signup",
  "/forgot-password",
  "/bot/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW_PATHS,
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: DISALLOW_PATHS,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
