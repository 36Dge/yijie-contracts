.PHONY: generate lint test breaking build

generate:
	pnpm generate

lint:
	pnpm lint

test:
	pnpm test

breaking:
	pnpm breaking

build:
	pnpm build

# Isolated local candidate family. Keep the committed native Chat generator and
# package manifest byte-identical to their immutable consumer pin.
.PHONY: workflow-generate workflow-check workflow-test
workflow-generate:
	node scripts/generate-workflow-local.mjs

workflow-check:
	node scripts/check-workflow-local.mjs

workflow-test:
	node --test tests/workflow-local.test.mjs tests/workflow-local-browser.test.mjs

.PHONY: scheduled-recovery-generate scheduled-recovery-check scheduled-recovery-test
scheduled-recovery-generate:
	node scripts/generate-scheduled-task-recovery.mjs

scheduled-recovery-check:
	node scripts/check-scheduled-task-recovery.mjs

scheduled-recovery-test:
	node --test tests/scheduled-task-recovery.test.mjs

.PHONY: scheduled-execution-generate scheduled-execution-check scheduled-execution-test
scheduled-execution-generate:
	node scripts/generate-scheduled-execution.mjs

scheduled-execution-check:
	node scripts/check-scheduled-execution.mjs
	node scripts/sync-scheduled-execution.mjs --check

scheduled-execution-test:
	node --test tests/scheduled-execution.test.mjs

.PHONY: scheduled-draft-generate scheduled-draft-check scheduled-draft-test
scheduled-draft-generate:
	node scripts/generate-scheduled-draft.mjs
scheduled-draft-check:
	node scripts/check-scheduled-draft.mjs
	node scripts/generate-scheduled-draft.mjs --check
	node scripts/sync-scheduled-draft.mjs --check
scheduled-draft-test:
	node --test tests/scheduled-draft.test.mjs
.PHONY: runtime-input-only-generate runtime-input-only-check
runtime-input-only-generate:
	node scripts/generate-runtime-input-only.mjs
runtime-input-only-check:
	node scripts/generate-runtime-input-only.mjs --check
	node scripts/sync-runtime-input-only.mjs --check
# Independent, read-only local clock family; no legacy generator bypass.
.PHONY: native-timing-generate native-timing-check native-timing-test
native-timing-generate:
	node scripts/generate-native-turn-timing.mjs
native-timing-check:
	node scripts/generate-native-turn-timing.mjs --check
	node scripts/sync-native-turn-timing.mjs --check
native-timing-test:
	node --test tests/native-turn-timing.test.mjs
