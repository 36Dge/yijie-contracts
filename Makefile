.PHONY: generate lint test breaking build

generate: market-selection-generate market-broker-generate market-host-generate
	pnpm generate

lint: market-selection-check market-broker-check market-host-check
	pnpm lint

test: market-selection-test market-broker-test market-host-test
	pnpm test

breaking:
	pnpm breaking

build: market-selection-check market-broker-check market-host-check
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

# FEAT-157 isolated local IPC family; legacy generators/source pins stay intact.
.PHONY: market-connectors-generate market-connectors-check market-connectors-test
market-connectors-generate:
	node scripts/generate-market-connectors.mjs
market-connectors-check:
	node scripts/generate-market-connectors.mjs --check
market-connectors-test:
	node --test tests/market-connectors.test.mjs
	go test ./sdks/go/market-connectors
	cargo test --offline --locked --manifest-path tests/rust-market-connectors/Cargo.toml --target-dir /tmp/yijie-feat157-contracts-rust-target
	cargo clippy --offline --locked --manifest-path tests/rust-market-connectors/Cargo.toml --target-dir /tmp/yijie-feat157-contracts-rust-target --all-targets -- -D warnings

# Independent JSON Schema + private Native IPC manifest. No HTTP/Host provider.
.PHONY: market-selection-generate market-selection-check market-selection-test
market-selection-generate:
	node scripts/generate-market-selection.mjs
market-selection-check:
	node scripts/generate-market-selection.mjs --check
market-selection-test:
	node --test tests/market-selection.test.mjs
	go test ./sdks/go/market-selection
	cargo test --offline --locked --manifest-path tests/rust-market-selection/Cargo.toml --target-dir /tmp/yijie-feat157-selection-contract-target
	cargo clippy --offline --locked --manifest-path tests/rust-market-selection/Cargo.toml --target-dir /tmp/yijie-feat157-selection-contract-target --all-targets -- -D warnings

# FEAT-157 private Host-owned worker control; no public listener or release pin.
.PHONY: market-broker-generate market-broker-check market-broker-test
market-broker-generate:
	node scripts/generate-market-broker.mjs
market-broker-check:
	node scripts/generate-market-broker.mjs --check
market-broker-test:
	node --test tests/market-broker.test.mjs
	go test ./sdks/go/market-broker-control ./sdks/go/market-selection
	cargo test --offline --locked --manifest-path tests/rust-market-broker/Cargo.toml --target-dir /tmp/yijie-feat157-broker-contract-target
	cargo clippy --offline --locked --manifest-path tests/rust-market-broker/Cargo.toml --target-dir /tmp/yijie-feat157-broker-contract-target --all-targets -- -D warnings

.PHONY: market-host-generate market-host-check market-host-test
market-host-generate:
	node scripts/generate-market-provider.mjs
	node scripts/generate-market-host.mjs
market-host-check:
	node scripts/generate-market-provider.mjs --check
	node scripts/generate-market-host.mjs --check
market-host-test:
	node --test tests/market-host.test.mjs
	go test ./sdks/go/market-host ./sdks/go/market-provider
	cargo test --offline --locked --manifest-path tests/rust-market-host/Cargo.toml --target-dir /tmp/yijie-feat157-market-host-contract-target
	cargo clippy --offline --locked --manifest-path tests/rust-market-host/Cargo.toml --target-dir /tmp/yijie-feat157-market-host-contract-target --all-targets -- -D warnings
