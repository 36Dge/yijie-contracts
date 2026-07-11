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
