import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPages, findRepeatedLines, normalizeText } from "../lib/ingest/clean";
import { createProgressReporter, stagePercent, toStep } from "../lib/ingest/progress";
import { embedInBatches } from "../lib/ingest/embed";
import { detectFileKind, parseTxtPages } from "../lib/ingest/parse";
import type { Embeddings } from "@langchain/core/embeddings";

test("normalizeText joins hyphenated breaks, collapses whitespace, strips control chars", () => {
    const out = normalizeText("infor-\nmation\u0000  here\r\n\r\n\r\n\r\nnext​ line");
    assert.equal(out, "information here\n\nnext line");
});

test("cleanPages drops repeated headers/footers and page-number lines, keeps page numbers", () => {
    const pages = [1, 2, 3, 4].map(
        (n) => `ACME Corp Handbook\nContent of page ${n} is unique.\nPage ${n} of 4`,
    );
    pages.push("   \n 5 \n"); // blank-ish page
    assert.ok(findRepeatedLines(pages.map(normalizeText)).has("ACME Corp Handbook"));
    const cleaned = cleanPages(pages);
    assert.equal(cleaned.length, 4);
    assert.deepEqual(cleaned[2], { pageNumber: 3, text: "Content of page 3 is unique." });
});

test("progress only reports on new 10% steps and never goes backwards", async () => {
    assert.equal(stagePercent("embed", 0.5), 65);
    assert.equal(toStep(65), 60);
    const steps: number[] = [];
    const report = createProgressReporter(async (step) => {
        steps.push(step);
    });
    for (let i = 0; i <= 100; i++) await report("embed", i / 100);
    await report("parse", 1); // earlier stage — ignored
    await report("store", 1);
    assert.deepEqual(steps, [40, 50, 60, 70, 80, 90, 100]);
});

test("embedInBatches batches, retries 429s with backoff, and reports progress", async () => {
    let calls = 0;
    const fake = {
        embedDocuments: async (texts: string[]) => {
            calls++;
            if (calls === 2) throw Object.assign(new Error("rate limit"), { status: 429 });
            return texts.map(() => [1, 2, 3]);
        },
    } as unknown as Embeddings;
    const progress: string[] = [];
    const vectors = await embedInBatches(
        fake,
        ["a", "b", "c", "d", "e"],
        async (done, total) => {
            progress.push(`${done}/${total}`);
        },
        { batchSize: 2, sleepFn: async () => {} },
    );
    assert.equal(vectors.length, 5);
    assert.equal(calls, 4); // 3 batches + 1 retry
    assert.deepEqual(progress, ["2/5", "4/5", "5/5"]);
});

test("embedInBatches does not retry permanent errors", async () => {
    const fake = {
        embedDocuments: async () => {
            throw Object.assign(new Error("invalid api key"), { status: 401 });
        },
    } as unknown as Embeddings;
    await assert.rejects(embedInBatches(fake, ["a"], undefined, { sleepFn: async () => {} }), /invalid api key/);
});

test("detectFileKind checks magic bytes, not just extension", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 ...");
    const txt = new TextEncoder().encode("hello");
    assert.equal(detectFileKind("a.pdf", pdf), "pdf");
    assert.equal(detectFileKind("a.pdf", txt), null); // renamed text file
    assert.equal(detectFileKind("a.txt", pdf), null); // PDF disguised as txt
    assert.equal(detectFileKind("a.txt", txt), "txt");
    assert.equal(detectFileKind("a.exe", txt), null);
});

test("parseTxtPages strips BOM and splits on form feeds", () => {
    const pages = parseTxtPages(Buffer.from("﻿one\ftwo", "utf8"));
    assert.deepEqual(pages, ["one", "two"]);
});
