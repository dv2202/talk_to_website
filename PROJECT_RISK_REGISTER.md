# Project risk register and fix plan

Last reviewed: 2026-10-27. This is a code-review register, not a record of fixes or a deployed-system penetration test. Recheck each finding against current code before implementation. Keep the associated regression tests after fixing a finding.

## Product constraint: public, anonymous customer chat

The widget is embedded on a client's public website. Customers must be able to ask questions without creating an account or logging in. Owner/dashboard authentication remains separate. The visitor protections below mean an anonymous, server-issued session or room capability that proves access to that visitor's own data; they do **not** mean a customer login screen. A new visitor should be able to start a chat immediately, while one visitor must not be able to read another visitor's history or live room. The widget key is visible in browser code and is a public bot identifier, not an authentication secret.

## P0 — fix before enterprise rollout

### P0-1: Conversation history can be read without visitor authorization

Evidence: `frontend/app/api/chat/[botId]/route.ts`. The GET route validates the widget key and origin only when `visitorId` is supplied. With neither `visitorId` nor `sessionId`, the query is scoped only by `botId` and returns up to 50 conversations. A supplied `sessionId` is also not tied to an authenticated visitor.

Fix plan:
1. Let anonymous visitors start chatting immediately. At first use, issue an opaque or signed, bot-scoped visitor session token and bind it to the visitor record. The widget sends it on later history requests. Do not accept a caller-supplied visitor ID as proof of ownership. No customer login is required.
2. Require a selector (`visitorId` or server-bound session) and authorization before querying. Return 401/403 on missing or mismatched credentials.
3. Keep owner history under the existing authenticated owner/admin API rather than the public widget route.
4. Add route tests for missing selectors, guessed session IDs, another visitor's ID, another bot's visitor, and valid same-visitor reads.

Done when no unauthenticated request can list a bot's conversations or retrieve another visitor's messages.

### P0-2: Live-chat visitor and room authorization is incomplete

Evidence: `frontend/lib/live-chat-http.ts` requires a widget key only when a caller supplies one or a visitor ID, and compares visitor IDs only when both room and request have one. The live room GET, message POST, and expire POST routes use this helper. `frontend/lib/live-hub.ts` accepts a visitor WebSocket `hello` without a server-issued visitor credential, and `handleExpire` checks only that a socket connection exists, not its role or room membership.

Fix plan:
1. When an anonymous visitor opens a live room, issue a short-lived room-bound capability and use one server-side authorization function to verify it on REST and WebSocket paths. No customer login is required.
2. Require exact room-to-visitor binding. Reject missing visitor identity for rooms that have a visitor; do not treat the public widget key as visitor authentication.
3. For every WebSocket action, verify authenticated role, bot, and room membership. In particular, allow `expire` only for that room's visitor or owner and derive `endedBy` on the server.
4. Add negative tests for cross-room subscribe, message, typing, and expire; test both WebSocket and REST fallback paths.

Done when knowing a room ID or a public widget key does not permit reading, writing to, or ending another visitor's room.

### P0-3: URL ingestion can fetch unsafe destinations

Evidence: `frontend/app/api/knowledge/url/{route.ts,discover/route.ts,scrape-batch/route.ts}` validates inputs with `new URL()` only. `frontend/lib/services/scraper.ts` follows fetch redirects and also passes URLs to Playwright. There is no shared protocol, hostname/IP, DNS, or redirect-destination policy.

Fix plan:
1. Permit only `http:` and `https:`; reject credentials in URLs, loopback/private/link-local/reserved IPs, localhost-style names, and internal metadata endpoints.
2. Resolve DNS and verify every resolved address before connecting. Revalidate each redirect target and Playwright navigation. Restrict discovery and batch scraping to the approved website origin unless an explicit product requirement says otherwise.
3. Enforce network egress restrictions outside the application as defense in depth.
4. Add tests for direct IPs, DNS aliases, redirects to private hosts, unsupported schemes, encoded hostnames, and mixed public/private DNS answers.

Done when user-supplied URLs and redirects cannot make the server or browser fetch internal destinations.

## P1 — correctness, reliability, and abuse control

| ID | Finding and evidence | Fix plan |
| --- | --- | --- |
| P1-1 | Keyword-only retrieval is discarded when vector search fails: `frontend/lib/rag/retriever/retriever.ts` returns `vectorResults` whenever only one fusion list exists. Embedding failure prevents keyword search entirely. | Run lexical search independently; return the one available result list; report branch failures separately; test vector-down and embedding-down cases. |
| P1-2 | Zero retrieved chunks trigger an unbounded full-knowledge prompt: `frontend/app/api/chat/route.ts` and voice route. | Distinguish no-index, no-match, and search-error states. Use a bounded fallback only for a documented transition period; otherwise abstain or request handoff. |
| P1-3 | Reindex deletes chunks before batch insertion and source hashes omit parser/chunker/model configuration: `frontend/lib/rag/vector-store/repository.ts`, `frontend/lib/rag/sync/incrementalSync.ts`. Empty single-source sync leaves old chunks. | Build a versioned replacement index, verify count/dimensions, atomically switch the active version, then delete old chunks. Include pipeline version in sync identity and clear chunks for empty sources. |
| P1-4 | Public widget key is exposed in browser config and can be omitted on some visitor paths: `frontend/app/api/widget/config/[botName]/route.ts`, `frontend/lib/chat-utils.ts`. No visible per-IP/visitor/bot rate limit or request-size bound. | Keep anonymous chat open. Treat widget key as public identification; use server-issued anonymous visitor tokens only for visitor-specific data/actions, plus origin policy, layered rate limits, payload caps, and atomic usage reservations. |
| P1-5 | Retrieval uses `ILIKE '%term%'` with an unordered candidate cap; no full-text index/reranker: `frontend/lib/rag/vector-store/repository.ts`. | Add indexed lexical search, deterministic ranking, evaluate fusion weights, then consider reranking if measured recall/precision needs it. |
| P1-6 | The answer has prompt-only grounding/abstention, and fetched knowledge is placed in the system instruction: `frontend/lib/rag/prompt/promptBuilder.ts`. | Isolate retrieved text as untrusted data, add evidence sufficiency checks, prompt-injection regression cases, and supported-answer evaluation. |
| P1-7 | Retrieval embeds only the latest turn despite history in the answer prompt: `frontend/app/api/chat/route.ts`. | Add query rewriting or history-aware retrieval; compare against baseline on labeled follow-up questions. |
| P1-8 | Configurable embedding dimensions can differ from the fixed `vector(1536)` schema: `frontend/lib/rag/config.ts`, `frontend/prisma/schema.prisma`. | Validate configuration at startup and require a schema/index migration when dimensions or model change. |
| P1-9 | Ingestion and embedding run inside request handlers; failed upload sync is swallowed: knowledge upload and URL save-batch routes. | Use durable jobs, retries, idempotency keys, explicit source/index status, and a reconciliation job. |
| P1-10 | Model monitoring can send full prompts and responses to GovernXOne: `frontend/lib/gemini.ts`. | Define tenant consent, redaction, retention, access policy, and provider configuration before using customer data in production evals. |

## P2 — enterprise capabilities and maintainability

- Add trace IDs and persist retrieved chunk IDs/scores, source versions, prompt/model/index versions, fallback reason, token use, and stage latency for every turn. Production routes currently store only question and answer in `Conversation`.
- Build offline evals for ingestion, Recall@K, answer correctness, groundedness, abstention, multilingual/multi-turn behavior, prompt injection, tenant isolation, latency, and cost. Use redacted real cases plus adversarial cases; gate releases on fixed regression sets.
- Unify text, voice, standalone `queryWithRAG`, and owner suggestion logic where they should share retrieval/prompt behavior. Record intentional differences.
- Improve PDF table/scan extraction and preserve website structure, page URLs, headings, and provenance in chunks.
- Add organization accounts, roles, audit logs, data retention/deletion controls, privacy controls, and service objectives based on target enterprise requirements. The schema currently models a single owning user per bot.
- Replace or harden the in-memory live-chat WebSocket hub if delivery guarantees are required across instances; REST polling currently provides recovery.
- Correct `frontend/lib/rag/README.md`: it calls the character chunk sizes tokens, gives a sample 3072-dimensional embedding against a 1536-dimensional schema, and lists hybrid search as future work even though a hybrid branch exists.
- Add a test command and targeted automated regression tests. No test files or test script were visible at review time.

## Implementation order

1. P0-1, P0-2, P0-3, with focused security regression tests.
2. P1-1 through P1-4 to make retrieval behavior and public traffic safe and observable.
3. Shared answer pipeline and traces, then a versioned eval dataset and baseline run.
4. Improve search, grounding, ingestion, and enterprise controls according to measured failures and customer requirements.

Existing unrelated working-tree changes, including `frontend/package-lock.json`, were not modified for this register.
