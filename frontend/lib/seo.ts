export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://botwebai.com";

export const SITE_NAME = "BotWebAI";

export const SITE_TITLE =
  "BotWebAI — AI Website Widget & Customer Support Chatbot";

export const SITE_DESCRIPTION =
  "Embed an AI website widget for 24/7 customer support. BotWebAI adds RAG-grounded AI chatbot integration, AI support automation, and one-script embed for any website.";

export const SITE_KEYWORDS = [
  "BotWebAI",
  "website widget AI",
  "AI website widget",
  "AI chatbot widget",
  "website AI chatbot",
  "AI customer support",
  "AI support integration",
  "AI support chatbot",
  "customer support AI",
  "AI live chat",
  "live chat AI widget",
  "embed AI chat",
  "embed AI chatbot",
  "AI chat widget for website",
  "website AI assistant",
  "AI helpdesk widget",
  "RAG chatbot",
  "RAG AI support",
  "retrieval augmented generation chatbot",
  "AI knowledge base chatbot",
  "automated customer support",
  "24/7 AI support",
  "AI customer service widget",
  "chatbot for website",
  "website chatbot integration",
  "AI chatbot integration",
  "support bot for website",
  "intelligent website assistant",
  "AI FAQ chatbot",
  "conversational AI widget",
  "SaaS AI support tool",
  "no-code AI chatbot",
  "script tag chatbot embed",
  "AI support automation",
  "omnichannel AI support",
  "grounded AI answers",
  "source-attributed AI chatbot",
  "AI escalation chatbot",
  "website AI agent",
  "AI virtual assistant for websites",
];

export const OG_IMAGE_PATH = "/logo.png";

export function absoluteUrl(path = "/"): string {
  const base = SITE_URL.replace(/\/$/, "");
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/logo.png"),
    description: SITE_DESCRIPTION,
    sameAs: [] as string[],
  };
}

export function getWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
  };
}

export function getSoftwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free plan available",
    },
    featureList: [
      "AI website widget",
      "AI chatbot integration",
      "RAG-grounded customer support",
      "One-script embed",
      "Source attribution",
      "Smart human escalation",
    ],
  };
}
