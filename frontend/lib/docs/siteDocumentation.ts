export const SUPPORT_EMAIL = "contact@botwebai.com";

export type DocSection = {
  id: string;
  title: string;
  body: string;
};

export const SITE_DOCUMENTATION: DocSection[] = [
  {
    id: "overview",
    title: "About BotWebAI",
    body: `BotWebAI is an AI customer support platform that lets businesses build intelligent assistants grounded in their own content. Visitors get accurate answers from your knowledge base — not generic guesses.

You can import knowledge from PDF files, plain text files, and website URLs. Visitors interact through an embeddable chat widget on your site or a standalone chat page. Business owners manage assistants, knowledge sources, and conversations from a web dashboard.

BotWebAI is built for teams who want 24/7 AI support without building and maintaining their own AI infrastructure.`,
  },
  {
    id: "what-it-can-do",
    title: "What BotWebAI Can Do",
    body: `Core capabilities:

1. AI Customer Support Chat — Answer visitor questions 24/7 using content from your knowledge base.

2. Knowledge Import — Upload PDF and TXT files, or crawl website URLs to discover and index pages. Content is prepared automatically for accurate retrieval.

3. Embeddable Chat Widget — Add a single script tag to any website. Customize position, theme color, logo, welcome message, quick questions, and teaser popups.

4. Standalone Bot Page — Share a public link at /bot/[botName] for a full-page chat experience.

5. Conversation Inbox — View all visitor conversations in the dashboard, including message history and visitor details.

6. Multi-Language Support — Configure a default language for each assistant from 100+ supported languages.

7. Custom AI Behavior — Set a system prompt to control tone, scope, and how the assistant should respond. Customize greetings, quick-reply buttons, and escalation behavior.

8. Security Controls — Each assistant has a unique widget API key. Optionally restrict the widget to specific allowed domains. Dashboard access requires login.

9. Easy Knowledge Updates — When you update sources, changes sync automatically so answers stay current.`,
  },
  {
    id: "pricing",
    title: "Pricing Plans",
    body: `BotWebAI offers three plans. All paid plans are billed monthly in INR.

Free plan — ₹0 / month
- 1 AI assistant
- 100 conversations monthly
- Chat mode
- BotWebAI branding on the widget
Best for trying BotWebAI with light usage.

STARTER — ₹999 / month
- 1 AI assistant
- 1,000 conversations / 30 days
- Chat mode
- No BotWebAI branding
- Email support at contact@botwebai.com
Best for solo founders launching their first AI assistant.

PRO — ₹1,999 / month (Most popular)
- 2 AI assistants
- 2,500 conversations / 30 days
- Chat mode
- No BotWebAI branding
- Priority support at contact@botwebai.com
Best for growing teams that need more assistants and higher usage.

You can upgrade, renew, or manage billing from Dashboard > Billing. Cancel anytime — access continues until the end of your current billing period.`,
  },
  {
    id: "how-it-works",
    title: "How BotWebAI Works",
    body: `Simple flow from setup to live support:

1. Create an assistant and describe how it should behave.
2. Add your knowledge — upload PDFs/TXT files or import pages from your website.
3. BotWebAI indexes your content so the assistant can find the right information when answering.
4. Embed the widget on your site, or share the standalone bot page link.
5. Visitors ask questions; the assistant answers using your knowledge base.
6. Review conversations in the dashboard and update knowledge anytime.

Answers are grounded in your verified sources. If the assistant is unsure, it can stay within the scope you define in the system prompt or guide visitors to contact the BotWebAI team at contact@botwebai.com.`,
  },
  {
    id: "setup-time",
    title: "How Long Does Setup Take?",
    body: `Most teams go live in under 10 minutes:

- Sign up and create an account: 1 to 2 minutes
- Create your first assistant: 2 to 3 minutes
- Add knowledge (URL import or file upload): 3 to 5 minutes
- Configure the widget: 1 to 2 minutes
- Copy the embed script onto your website: 1 to 2 minutes

Knowledge indexing usually takes seconds to a few minutes depending on file size and how many pages you import.

After launch, knowledge updates sync when you change sources — no retraining required. You can regenerate widget API keys from the dashboard if needed.`,
  },
  {
    id: "how-to-use",
    title: "How to Use BotWebAI",
    body: `STEP-BY-STEP GUIDE FOR BUSINESS OWNERS:

Step 1 — Create an Account
Go to the BotWebAI website and sign up with email/password or Google. Log in to access your dashboard.

Step 2 — Create an Assistant
Click "Create Assistant" in the dashboard. Complete the 3-step wizard:
- Step 1 (Basic Info): Set display name, bot slug (used in URLs like /bot/your-slug), description, system prompt, and default language
- Step 2 (Knowledge Base): Upload PDF/TXT files or add website URLs. Discover pages, select which ones to import, then save
- Step 3 (Widget Config): Choose widget position, allowed domains, and customize branding (logo, theme color, welcome text, quick questions, teaser message).

Step 3 — Embed on Your Website
From the dashboard, copy the embed script tag and paste it before the closing </body> tag on any page where you want the chat widget to appear.

Step 4 — Share Standalone Link (Optional)
Share https://botwebai.com/bot/your-bot-slug with customers who prefer a full-page chat experience.

Step 5 — Monitor Conversations
Go to Dashboard > Conversations to view visitor threads and review how the AI is performing.

Step 6 — Update Knowledge
Edit your assistant to add, remove, or update knowledge sources. Changes sync automatically.

FOR WEBSITE VISITORS:
- Click the chat bubble on an embedded site or open the standalone bot link
- Optionally enter name and email, or skip
- Type questions in the chat
- The AI answers based on the business knowledge base`,
  },
  {
    id: "widget-embed",
    title: "Widget Embed Reference",
    body: `Embed the BotWebAI chat widget on any website:

Basic embed script:
<script src="https://botwebai.com/api/widget/widget.js" data-bot="YOUR_BOT_SLUG" data-api-key="ttw_YOUR_API_KEY"></script>

Script attributes:
- data-bot (required): Your assistant slug
- data-api-key (required): Widget API key from the dashboard
- data-theme (optional): auto, light, or dark
- data-position (optional): bottom-right or bottom-left

Security tips:
- Keep your widget API key private when possible, and regenerate it from the dashboard if it is compromised
- Set allowed domains on your assistant so the widget only works on your approved sites`,
  },
  {
    id: "dashboard",
    title: "Dashboard Guide",
    body: `What you can manage from the dashboard:

Home — List all assistants. Copy embed code, view bot details, delete assistants, edit allowed domains, and regenerate API keys.

Create Assistant — 3-step wizard for basic info, knowledge base, and widget configuration.

Edit Assistant — Update settings and manage knowledge sources (upload, URL import, delete).

Conversations — Browse visitor threads and full message history for each assistant.

Billing — View your current plan, upgrade to Starter or Pro, renew, or cancel.

Profile — Update your account settings.`,
  },
  {
    id: "knowledge",
    title: "Knowledge Base",
    body: `Adding knowledge to your assistant:

FILE UPLOAD
- Supported formats: PDF, TXT
- Upload via the dashboard when creating or editing an assistant
- Content is processed automatically so the assistant can answer from it

URL IMPORT
- Paste your website URL in the knowledge flow
- Discover relevant pages, select which ones to import, then save
- Imported pages become part of your assistant's knowledge base

Keeping knowledge fresh:
- Add, remove, or update sources anytime from the edit screen
- Changes sync automatically so answers stay up to date
- Use clear, accurate source content for the best answer quality`,
  },
  {
    id: "security",
    title: "Security and Privacy",
    body: `BotWebAI security features:

- Data encrypted at rest and in transit
- Per-assistant widget API keys for embed authentication
- Optional domain restriction per assistant — widget only works on approved sites
- Dashboard access requires login
- Each account's bots and knowledge are isolated from other accounts
- Widget API key regeneration available from the dashboard if a key is compromised

Chat data:
- Conversations are stored securely for inbox review
- Visitor details may be collected to help you manage support threads
- Business owners can review full conversation history in the dashboard`,
  },
  {
    id: "faq",
    title: "Frequently Asked Questions",
    body: `Q: Will the AI give wrong answers?
A: BotWebAI answers from your verified knowledge base. When confidence is low, it can stay within the scope you define or guide visitors to your team at contact@botwebai.com. Answers are based on your content, not general internet knowledge.

Q: How can I connect with your team / contact support?
A: Email the BotWebAI team at contact@botwebai.com. Starter includes email support and Pro includes priority support. We aim to respond within 24 to 48 hours on business days.

Q: How long does setup take?
A: Most teams go live in under 10 minutes. Import your content and add one script tag.

Q: What plans are available?
A: Free plan (₹0), Starter (₹999/month), and Pro (₹1,999/month). See the Pricing Plans section for limits and features.

Q: Can I customize the AI responses?
A: Yes. Train on your docs, set tone of voice via system prompt, customize greetings, quick questions, and control widget appearance.

Q: Is chat data secure?
A: Encrypted at rest and in transit. Per-assistant API keys, authenticated dashboard access, and account-isolated data.

Q: What integrations do you support?
A: Embed on any website with a script tag. Standalone bot page for direct links. Works with React, static sites, WordPress, and more.

Q: Does it read from my existing docs?
A: Yes. Paste your website URL and BotWebAI can import your docs, FAQs, and help articles. You can also upload PDF and TXT files directly.

Q: What languages are supported?
A: 100+ languages. Set a default language per assistant in the dashboard.

Q: How do I update my knowledge base?
A: Edit your assistant in the dashboard, add or remove sources, and changes sync automatically.

Q: Can I cancel anytime?
A: Yes. Cancel from Dashboard > Billing. You keep access until the end of your current billing period.`,
  },
  {
    id: "contact-support",
    title: "Contact Support",
    body: `Need help with BotWebAI? Contact support:

Email: contact@botwebai.com

When reaching out, please include:
- Your account email
- Assistant name or bot slug (if applicable)
- A description of the issue or question
- Screenshots or error messages if reporting a bug

Support topics we can help with:
- Account and login issues
- Assistant setup and configuration
- Knowledge base import problems
- Widget embed and troubleshooting
- Billing and plan questions
- Feature requests and feedback

Response time: We aim to respond within 24 to 48 hours on business days. Starter includes email support; Pro includes priority support.`,
  },
];

export function documentationToMarkdown(): string {
  const lines: string[] = [
    "# BotWebAI — Product Documentation",
    "",
    "This document covers how to use BotWebAI.",
    "For support, email: contact@botwebai.com",
    "",
  ];

  for (const section of SITE_DOCUMENTATION) {
    lines.push(`## ${section.title}`, "", section.body.trim(), "");
  }

  return lines.join("\n");
}

export function documentationToPlainText(): string {
  return documentationToMarkdown()
    .replace(/^#+\s/gm, "")
    .replace(/\*\*/g, "");
}
