import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

test("listing schema accepts a minimal listing and rejects an invalid URL", async () => {
  const schema = JSON.parse(await readFile("jsonschema/ecommerce/listing.schema.json", "utf8"));
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate({ platform: "amazon", url: "https://www.amazon.com/dp/example" }), true);
  assert.equal(validate({ platform: "amazon", url: "not-a-url" }), false);
});
