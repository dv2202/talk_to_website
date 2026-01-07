import type { Metadata } from "next";
import { LegalPageShell } from "@/components/LegalPageShell";
import { SUPPORT_EMAIL } from "@/lib/docs/siteDocumentation";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BotWebAI collects, uses, and protects personal data for account holders, website visitors, and chatbot end users.",
};

const EFFECTIVE_DATE = "August 6, 2026";

const sections = [
  {
    title: "1. Who we are",
    paragraphs: [
      `BotWebAI ("BotWebAI", "we", "us", or "our") provides an AI customer support platform at botwebai.com. Businesses use BotWebAI to build AI assistants grounded in their own knowledge (PDFs, text files, and website URLs), embed a chat widget on their sites, and review conversations in a dashboard.`,
      `This Privacy Policy explains what information we collect, how we use it, and the choices available to you. For questions, contact us at ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    title: "2. Whose data we process",
    paragraphs: [
      "We process personal data for three main groups:",
    ],
    bullets: [
      "Account holders — people who create a BotWebAI account to build and manage assistants.",
      "Website visitors on botwebai.com — people who browse our marketing site, contact us, or use public pages.",
      "End users of customer assistants — people who chat with a BotWebAI widget or standalone bot page hosted by one of our customers.",
    ],
    afterBullets: [
      "If you use a chatbot embedded by a BotWebAI customer, that customer is typically the primary controller of the conversation data related to their business. We process that data to provide the Service on their behalf.",
    ],
  },
  {
    title: "3. Information we collect",
    paragraphs: [
      "Account and authentication data. When you sign up or log in we collect your name, email address, and password (stored as a hash). You may also sign in with Google, in which case we receive basic profile information from Google (such as name, email, and profile image) as permitted by that provider. We store session information, which may include IP address and user agent.",
      "Email verification and account recovery. We send one-time passcodes (OTPs) by email for signup verification and password reset. Temporary signup records (email, name, and hashed credentials/OTP) are kept only until verification completes or expires.",
      "Assistant and knowledge data. Account holders provide assistant settings (name, prompts, branding, widget configuration, allowed domains, fallback contact details such as email, phone, WhatsApp, or Telegram) and knowledge sources (uploaded PDFs or text files, and content imported from URLs they choose). We store and process this content—including chunked text and embeddings—to power retrieval-augmented answers.",
      "Conversation and visitor data. When someone uses an assistant, we store messages and AI responses. Depending on widget settings and visitor choices, we may also store visitor profile details (name, email), technical metadata (IP address, approximate country, user agent, device type, platform, timezone, language), and session identifiers. Account holders can review this information in their dashboard inbox.",
      "Billing data. For paid plans (Starter and Pro), we process subscription and payment records through Razorpay, including plan selection, amounts (INR), payment status, and Razorpay order/subscription/payment identifiers. Card and bank details are handled by Razorpay; we do not store full payment card numbers.",
      "Contact and support. If you use our contact form or email us, we collect your name, email, subject, and message so we can respond.",
      "Optional integrations. Account holders may voluntarily save third-party credentials (for example GovernXOne API settings) in their profile. Those credentials are used only to provide the requested integration.",
      "Cookies and similar technologies. We use session cookies and similar technologies required to keep you logged in, secure the Service, and remember essential preferences (such as theme). We do not operate a separate advertising pixel network on the marketing site as part of the core product described here.",
    ],
  },
  {
    title: "4. How we use information",
    bullets: [
      "Provide, operate, and improve the BotWebAI platform, including RAG answers, widgets, dashboards, and billing.",
      "Authenticate users, protect accounts, and prevent abuse or fraud.",
      "Send transactional emails (verification codes, password resets, billing notices).",
      "Process payments and manage Free, Starter, and Pro subscriptions.",
      "Respond to support and contact requests.",
      "Enforce our Terms of Service and comply with legal obligations.",
      "Generate embeddings and model outputs via AI providers so assistants can answer from customer knowledge.",
    ],
  },
  {
    title: "5. AI processing",
    paragraphs: [
      "To answer questions, BotWebAI sends relevant knowledge snippets and conversation context to AI and embedding providers (such as OpenAI and/or Google Gemini, depending on configuration). Those providers process the content needed to generate embeddings or replies. Do not upload secrets or data you are not allowed to process under applicable law.",
      "Answers are intended to be grounded in the knowledge you supply. Model outputs can still be imperfect; customers remain responsible for how they use AI replies with their own end users.",
    ],
  },
  {
    title: "6. How we share information",
    paragraphs: [
      "We do not sell personal information. We share data only as needed to run the Service:",
    ],
    bullets: [
      "Infrastructure and hosting providers that store or process data on our behalf (for example database and application hosting).",
      "Authentication providers (Google, when you choose Google sign-in).",
      "Payment processor (Razorpay) for subscriptions and invoices.",
      "AI / embedding providers used to power assistants.",
      "Email delivery infrastructure used to send OTPs and transactional mail.",
      "Professional advisors or authorities when required by law or to protect rights and safety.",
    ],
    afterBullets: [
      "Customer account holders can access conversation and visitor data collected through their own assistants. BotWebAI staff may access account data as needed for support, security, billing, or abuse investigation.",
    ],
  },
  {
    title: "7. Roles for customer chatbots",
    paragraphs: [
      "If you are a BotWebAI customer, you decide what knowledge to upload, which domains may host your widget, whether visitors are asked for contact details, and how you use conversation history. You are responsible for providing appropriate notices and obtaining any consents required for your end users under laws that apply to you (including privacy and marketing rules).",
      "If you are chatting with a customer’s BotWebAI assistant, that customer’s privacy practices also apply. You can ask that business how they use your messages and contact details, or contact us at the email above and we will help route the request where appropriate.",
    ],
  },
  {
    title: "8. Data retention",
    paragraphs: [
      "We retain account data while your account is active. Conversation, visitor, knowledge, and billing records are kept for as long as needed to provide the Service, meet plan features (such as inbox history), resolve disputes, enforce agreements, and comply with legal or accounting requirements. Pending signup records expire after a short period. You may request deletion of your account as described below; some records may be retained in backups or where law requires.",
    ],
  },
  {
    title: "9. Security",
    paragraphs: [
      "We use industry-standard measures appropriate to the Service, including encryption in transit, access controls, per-assistant widget API keys, optional domain allowlists for embeds, and account isolation so one customer’s bots and knowledge are not exposed to another customer’s account. No method of transmission or storage is 100% secure; please use strong passwords and protect your API keys.",
    ],
  },
  {
    title: "10. International transfers",
    paragraphs: [
      "BotWebAI may process data in India and in other countries where our providers operate. Where data is transferred internationally, we take steps designed to ensure an appropriate level of protection consistent with this Policy and applicable law.",
    ],
  },
  {
    title: "11. Your choices and rights",
    paragraphs: [
      "Depending on where you live, you may have rights to access, correct, delete, or export personal data, or to object to or restrict certain processing. Account holders can update profile details in the dashboard and contact us to request account-related changes or deletion.",
      "To exercise a privacy request, email ${SUPPORT_EMAIL} with enough detail for us to verify and fulfill the request. If the request concerns data collected through a customer’s assistant, we may redirect you to that customer or coordinate with them.",
    ],
  },
  {
    title: "12. Children’s privacy",
    paragraphs: [
      "BotWebAI is directed at businesses and adult users. The Service is not intended for children under 16 (or the minimum age required in your jurisdiction). We do not knowingly collect personal information from children. If you believe a child has provided us personal data, contact us and we will take appropriate steps.",
    ],
  },
  {
    title: "13. Changes to this Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. We will post the updated version on this page and revise the effective date. Material changes may also be communicated by email or in-product notice where appropriate. Continued use of the Service after an update means you acknowledge the revised Policy.",
    ],
  },
  {
    title: "14. Contact",
    paragraphs: [
      `Privacy inquiries: ${SUPPORT_EMAIL}`,
      "Website: https://botwebai.com",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      subtitle="How BotWebAI collects, uses, and protects information across accounts, billing, and AI assistants."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
      otherLegalHref="/terms"
      otherLegalLabel="Terms of Service"
    />
  );
}
