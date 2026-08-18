import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(await readFile("jsonschema/chat/message.schema.json", "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const attachmentMetadata = {
  attachmentId: "019fbd88-cbc3-7bf1-934d-7b05cd693f61",
  name: "quarterly-total.csv",
  sizeBytes: 20,
  status: "bound",
  expiresAt: "2026-08-24T12:00:00Z",
};

test("legacy ChatMessage remains valid without contentBlocks", () => {
  const legacy = {
    id: "message-legacy",
    role: "user",
    content: "legacy text",
  };
  assert.equal(validate(legacy), true, JSON.stringify(validate.errors));
});

test("ChatMessage accepts ordered text, file, and image metadata blocks", () => {
  const message = {
    id: "message-multimodal",
    role: "user",
    content: "",
    contentBlocks: [
      { type: "text", text: "Compare these attachments." },
      { type: "file", ...attachmentMetadata, mediaType: "text/csv" },
      {
        type: "image",
        ...attachmentMetadata,
        attachmentId: "019fbd88-cbc3-7bf1-934d-7b05cd693f62",
        name: "chart.png",
        mediaType: "image/png",
        status: "expired",
      },
    ],
  };
  assert.equal(validate(message), true, JSON.stringify(validate.errors));
  assert.deepEqual(
    message.contentBlocks.map(({ type }) => type),
    ["text", "file", "image"],
  );

  const invalidMessages = [
    { ...message, content: undefined },
    { ...message, contentBlocks: [] },
    { ...message, contentBlocks: Array.from({ length: 17 }, () => message.contentBlocks[0]) },
    { ...message, contentBlocks: Array.from({ length: 11 }, (_, index) => ({
      ...message.contentBlocks[1],
      attachmentId: `019fbd88-cbc3-7bf1-934d-${String(index + 1).padStart(12, "0")}`,
    })) },
    { ...message, contentBlocks: [{ type: "audio", text: "unsupported" }] },
    { ...message, contentBlocks: [{ ...message.contentBlocks[1], dataUrl: "data:text/plain;base64,eA==" }] },
    { ...message, contentBlocks: [{ ...message.contentBlocks[1], name: "../private.csv" }] },
    { ...message, contentBlocks: [{ ...message.contentBlocks[1], mediaType: "application/zip" }] },
    { ...message, contentBlocks: [{ ...message.contentBlocks[1], status: "ready" }] },
  ];
  for (const candidate of invalidMessages) {
    assert.equal(validate(candidate), false, JSON.stringify(candidate));
  }
});
