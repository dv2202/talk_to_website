import type { Metadata } from "next";
import { LegalPageShell } from "@/components/LegalPageShell";
import { SUPPORT_EMAIL } from "@/lib/docs/siteDocumentation";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing use of BotWebAI — accounts, AI assistants, embeddings, billing, and acceptable use.",
};

const EFFECTIVE_DATE = "August 6, 2026";

const sections = [
  {
    title: "1. Agreement",
    paragraphs: [
      `These Terms of Service ("Terms") govern access to and use of BotWebAI’s websites, dashboards, APIs, embeddable widgets, and related services (the "Service"). By creating an account, clicking to accept, or using the Service, you agree to these Terms.`,
      `If you use the Service on behalf of a company, you represent that you have authority to bind that company, and "you" includes that entity. If you do not agree, do not use the Service.`,
      `Our Privacy Policy (https://botwebai.com/privacy) explains how we handle personal data and is incorporated by reference.`,
    ],
  },
  {
    title: "2. The Service",
    paragraphs: [
      "BotWebAI lets you create AI assistants grounded in knowledge you supply (PDFs, text files, and selected website URLs), configure chat widgets, embed them on allowed domains or use a hosted bot page, and review conversations in a dashboard.",
      "Features, plan limits, and branding options are described on our pricing pages and may change. We may update, suspend, or discontinue parts of the Service with reasonable notice when practical.",
    ],
  },
  {
    title: "3. Accounts",
    paragraphs: [
      `You must provide accurate registration information and keep your credentials confidential. You are responsible for activity under your account. Notify us promptly at ${SUPPORT_EMAIL} if you suspect unauthorized access.`,
      "You may sign up with email and password (verified by OTP) or via supported social login (currently Google). You must be at least 16 years old (or the age of digital consent in your country) and legally able to enter a contract.",
    ],
  },
  {
    title: "4. Plans, fees, and billing",
    paragraphs: [
      "BotWebAI offers a Free plan and paid monthly plans (currently Starter and Pro) billed in Indian Rupees (INR). Paid subscriptions are processed by Razorpay. Prices, conversation limits, assistant limits, branding removal, and support levels are as stated at purchase or on /plans, unless we agree otherwise in writing.",
      "By starting a paid plan you authorize recurring charges for each billing period until you cancel. Taxes may apply. Fees already paid are generally non-refundable except where required by law or expressly stated by us.",
      "We may suspend or downgrade access if payment fails, a subscription expires, or usage exceeds plan limits. Free plan features may include BotWebAI branding on the widget.",
    ],
  },
  {
    title: "5. Customer content and licenses",
    paragraphs: [
      '"Customer Content" means knowledge sources, prompts, branding assets, fallback contact details, configuration, and other materials you upload or configure, as well as conversation data generated through your assistants.',
      "You retain ownership of Customer Content. You grant BotWebAI a worldwide, non-exclusive license to host, process, transmit, embed, and display Customer Content solely to provide and improve the Service (including generating embeddings, retrieving context, and producing replies).",
      "You represent that you have all rights needed to upload and use Customer Content, and that doing so does not violate law or third-party rights (including copyright, privacy, and confidentiality).",
    ],
  },
  {
    title: "6. AI outputs and your responsibilities",
    paragraphs: [
      "Assistants generate responses using AI models and retrieval over your knowledge. Outputs may be inaccurate, incomplete, or inappropriate. You must review critical answers and remain responsible for how your business uses the widget with end users.",
      "You are responsible for: (a) the accuracy of knowledge you import; (b) configuring allowed domains and securing widget API keys; (c) complying with laws that apply to your collection and use of end-user messages and contact details; (d) providing any privacy notices or consents your visitors require; and (e) your fallback contact channels and escalation practices.",
      "BotWebAI is not a law firm, medical provider, or regulated advisor. Do not rely on the Service as a substitute for professional advice where that would be inappropriate.",
    ],
  },
  {
    title: "7. Acceptable use",
    paragraphs: [
      "You agree not to:",
    ],
    bullets: [
      "Use the Service for unlawful, harmful, fraudulent, or abusive purposes.",
      "Upload malware, scrape the Service beyond permitted APIs, or attempt to bypass security, plan limits, or domain restrictions.",
      "Infringe intellectual property or privacy rights, or process special-category personal data unlawfully.",
      "Misrepresent BotWebAI outputs as human when disclosure is required, or use the Service to spam or harass.",
      "Resell, sublicense, or provide the Service to third parties as a competing white-label platform except as expressly allowed by your plan or a separate agreement.",
      "Interfere with other customers’ use of the Service or reverse engineer the platform except where such restriction is prohibited by law.",
    ],
  },
  {
    title: "8. Embeds and third-party sites",
    paragraphs: [
      "If you embed our widget on your website, you must only enable domains you control or are authorized to use. You are responsible for the pages where the widget appears and for any conflict between these Terms and your site’s own terms with visitors.",
      "Third-party services you connect (payment processor, Google login, AI providers, optional integrations such as GovernXOne) are governed by those providers’ terms. BotWebAI is not responsible for third-party outages or policies.",
    ],
  },
  {
    title: "9. Intellectual property",
    paragraphs: [
      "BotWebAI and its licensors own the Service, software, branding, documentation, and related intellectual property. These Terms do not transfer ownership to you. You may not copy, modify, or create derivative works of the Service except as needed to use it under these Terms.",
      "Feedback you provide may be used by us without obligation to you.",
    ],
  },
  {
    title: "10. Confidentiality",
    paragraphs: [
      "Each party may receive non-public information from the other. The receiving party will use reasonable care to protect that information and use it only for purposes of the Service relationship, except for information that is public, independently developed, or required to be disclosed by law.",
    ],
  },
  {
    title: "11. Suspension and termination",
    paragraphs: [
      `You may stop using the Service and request account closure by contacting ${SUPPORT_EMAIL}. We may suspend or terminate access if you breach these Terms, create risk for the platform or others, fail to pay, or if we discontinue the Service.`,
      "Upon termination, your right to use the Service ends. We may delete or deactivate Customer Content after a reasonable period, subject to legal retention needs and our Privacy Policy. Sections that by nature should survive (including ownership, disclaimers, limitations, and indemnity) will survive termination.",
    ],
  },
  {
    title: "12. Disclaimers",
    paragraphs: [
      'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, BOTWEBAI DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT AI OUTPUTS WILL BE ERROR-FREE, UNINTERRUPTED, OR MEET YOUR REQUIREMENTS.',
    ],
  },
  {
    title: "13. Limitation of liability",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, BOTWEBAI AND ITS AFFILIATES WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.",
      "OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE AMOUNTS YOU PAID TO BOTWEBAI FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM (OR, IF YOU USE ONLY THE FREE PLAN, ONE THOUSAND INDIAN RUPEES).",
      "Some jurisdictions do not allow certain limitations; in those cases our liability is limited to the fullest extent permitted by law.",
    ],
  },
  {
    title: "14. Indemnity",
    paragraphs: [
      "You will defend and indemnify BotWebAI against claims, damages, and expenses arising from your Customer Content, your use of the Service, your assistants’ interactions with end users, or your violation of these Terms or applicable law.",
    ],
  },
  {
    title: "15. Governing law",
    paragraphs: [
      "These Terms are governed by the laws of India, without regard to conflict-of-law rules. Courts in India will have exclusive jurisdiction over disputes, unless applicable consumer law gives you mandatory rights to bring claims elsewhere.",
    ],
  },
  {
    title: "16. Changes",
    paragraphs: [
      "We may update these Terms by posting a revised version on this page and updating the effective date. Material changes may also be notified by email or in-product notice. Continued use after changes become effective constitutes acceptance. If you do not agree, stop using the Service and cancel any paid subscription.",
    ],
  },
  {
    title: "17. Contact",
    paragraphs: [
      `Questions about these Terms: ${SUPPORT_EMAIL}`,
      "Website: https://botwebai.com",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Terms of Service"
      subtitle="The rules for using BotWebAI accounts, AI assistants, embeds, and paid plans."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
      otherLegalHref="/privacy"
      otherLegalLabel="Privacy Policy"
    />
  );
}
