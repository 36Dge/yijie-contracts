import type { components } from "../../sdks/typescript/src/openapi/workflow-local.gen.js";
import { validators, validateBridge } from "../../sdks/typescript/src/browser/workflow-local-validator.gen.js";

const list: components["schemas"]["ListRequest"] = {};
const operation: components["schemas"]["RunQueryInput"] = { kind: "operation", operation_id: "15300000-0000-4000-8000-000000000001" };
const run: components["schemas"]["RunQueryInput"] = { kind: "run", workflow_id: "123", run_id: "456" };
const history: components["schemas"]["RunQueryInput"] = { kind: "history", workflow_id: "123" };
validators.ListRequest(list);
for (const query of [operation, run, history]) validators.RunQueryInput(query);
const message: unknown = { protocol_version: 1, kind: "connect", request_id: "r", bridge_id: "b", generation: 1 };
if (validateBridge(message)) {
  const protocol: 1 = message.protocol_version;
  void protocol;
}
