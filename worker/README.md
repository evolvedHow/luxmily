# Luxmi.ly — Cloudflare Worker

Thin authenticated proxy between the GitHub Pages frontend and **Cloudflare
Workers AI**. Holds a Cloudflare API token as a secret so the browser never sees
it, and maintains a per-request cost ledger via a Durable Object.

No Modal, no third-party OpenAI provider, no per-endpoint provisioning — the
model is served directly by Workers AI over its OpenAI-compatible
`/v1/chat/completions` endpoint.

## Prerequisites

1. **A Cloudflare account** with Workers AI enabled (Dashboard → Workers AI → get
   started). The free tier covers **10,000 neurons/day** across the account.
2. **A Cloudflare API token** with the **Workers AI — Edit** permission:
   Dashboard → My Profile → API Tokens → Create Token → use the *Workers AI*
   template, scope it to **Account Resources → All accounts** (or your account).
   Note the account id (Dashboard → profile → Account ID).
3. **Wrangler** installed: `npm i -g wrangler` (or `npx wrangler`).

## Setup

```bash
cd worker/    # ← MUST be in worker/, not the repo root

# Set the Cloudflare credentials as Wrangler secrets
echo "<account-id>" | npx wrangler secret put CF_ACCOUNT_ID
echo "<api-token>"  | npx wrangler secret put CF_AI_API_TOKEN

# Deploy the worker
npx wrangler deploy
```

## Environment

### Secrets (set via `wrangler secret put`)

| Name | Value |
|------|-------|
| `CF_ACCOUNT_ID` | Your Cloudflare account id |
| `CF_AI_API_TOKEN` | API token with the "Workers AI — Edit" permission |

### Vars (set in `wrangler.toml`)

| Name | Default | Description |
|------|---------|-------------|
| `CFAI_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Workers AI model id to serve |
| `CFAI_BUDGET_USD` | `25` | Budget cap in USD (shown as balance in the UI) |
| `CFAI_IN_PRICE` | `0.051` | Per-1M input-token price in USD |
| `CFAI_OUT_PRICE` | `0.335` | Per-1M output-token price in USD |
| `ALLOWED_ORIGINS` | `*` | Comma-separated origin allowlist, e.g. `https://evolvedhow.github.io`. **Set this in production** |

Reasonable chat models on Workers AI (2026, price in $ per 1M in/out tokens):

| Model | In | Out | Notes |
|-------|----|-----|-------|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0.293 | 2.253 | Default — highest quality, answers directly (no reasoning phase) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 0.051 | 0.335 | Cheap MoE, but "thinks" before answering |
| `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | 0.045 | 0.384 | Fast all-rounder |
| `@cf/zai-org/glm-4.7-flash` | 0.060 | 0.400 | Good quality per neuron |

> **How pricing works:** Workers AI bills in **neurons** ($0.011 per 1,000,
> with a 10,000-neuron/day free allowance per account; resets 00:00 UTC). The
> `CFAI_IN_PRICE` / `CFAI_OUT_PRICE` values are the *dollar* per-token figures
> behind the neuron rates and are used for an **estimated** per-request cost.
> Workers AI exposes no live balance API, so the "≈ $ left" figures are
> estimates tracked by the Worker's Durable Object.

## Deploy the frontend with the worker URL

Set `VITE_LUXMI_WORKER` in the GitHub Pages build:

```yaml
# .github/workflows/deploy.yml
env:
  VITE_BASE: /luxmily/
  VITE_LUXMI_WORKER: https://luxmily-worker.<your-subdomain>.workers.dev
```

Or set it in `.env` for local dev:

```
VITE_LUXMI_WORKER=http://localhost:8787
```

Then `npm run dev` / `npm run build` picks it up automatically.

## Local development

```bash
cd worker/
npx wrangler dev       # → http://localhost:8787 (use --local for the Durable Object)
```

## How it works

1. **`POST /api/advise`** — The browser sends the OpenAI-compatible Chat
   Completions body (without a model name). The worker injects `model` from
   env, calls Workers AI at
   `https://api.cloudflare.com/client/v4/accounts/<id>/ai/v1/chat/completions`
   with `Authorization: Bearer <api-token>`, and streams the SSE response back
   to the browser verbatim. After the stream ends, it appends one extra SSE
   event:

   ```
   data: {"type":"usage","usage":{...},"costUsd":0.000312,"balanceUsd":24.5,"estimated":false}
   ```

   The frontend reads this to show per-request cost and remaining balance. If
   Workers AI doesn't echo `usage` in the stream, the worker falls back to a
   rough chars/4 token estimate and sets `"estimated": true`.

   Before forwarding, the worker **pins `model` from env**, forces `n: 1`, and
   clamps `max_tokens` to 4096 — a hand-rolled request body cannot select a
   pricier model or ask for an unbounded completion. If the ledger has already
   reached `CFAI_BUDGET_USD`, the request is refused with **429** instead.

2. **`GET /api/balance`** — Returns the Durable Object ledger:

   ```json
   { "budgetUsd": 25, "spentUsd": 0.5, "balanceUsd": 24.5, "currency": "usd" }
   ```

3. **Durable Object (`BalanceDO`)** — A single-instance DO keyed
   `"luxmi-budget"` that persists `spentUsd` across requests. The `/incr`
   endpoint adds a cost; `/get` reads the ledger.

## CORS & abuse

By default all responses include `Access-Control-Allow-Origin: *`, which serves
GitHub Pages at `https://evolvedhow.github.io`. Set `ALLOWED_ORIGINS` to narrow
it; requests carrying a disallowed `Origin` header get **403**.

> **⚠️ This endpoint is unauthenticated.** A static Pages frontend has nowhere
> to hide a credential, so anyone who learns the worker URL can spend your
> Workers AI allowance. The worker mitigates — origin allowlist, hard budget
> stop at `CFAI_BUDGET_USD`, server-pinned model, clamped `max_tokens` — but
> none of that is authentication. An `Origin` header is trivially forged by a
> non-browser client. For real protection put **Cloudflare Access** or **WAF
> rate-limiting** in front of the worker, or move to a signed-token scheme.

### Resetting the ledger

The budget stop reads the Durable Object, so once `spentUsd` reaches the budget
every request 429s. Raise `CFAI_BUDGET_USD` and redeploy, or delete the DO.