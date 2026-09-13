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
