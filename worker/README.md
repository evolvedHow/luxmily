# Luxmi.ly — Cloudflare Worker

Thin authenticated proxy between the GitHub Pages frontend and a Modal Dedicated
Endpoint. Holds the Modal proxy token as a secret so the browser never sees it.
Also maintains a per-request cost ledger via a Durable Object.

## Prerequisites

1. **Modal Dedicated Endpoint** with a Qwen model (or any OpenAI-compatible model).
   Create one in the Modal Dashboard → Endpoints → New Endpoint → Dedicated.
   Note the endpoint URL and the model name it serves.

2. **Modal Proxy Token** — Dashboard → Settings → Proxy Auth Tokens → Create.
   Note the token ID (`wk-...`) and secret (`ws-...`).

3. **Wrangler** installed: `npm i -g wrangler` (or `npx wrangler`).

## Setup

```bash
cd worker/

# Set the Modal proxy token as a Wrangler secret
echo "wk-1234abcd.ws-5678efgh" | npx wrangler secret put MODAL_PROXY_TOKEN

# Deploy the worker
npx wrangler deploy
```

## Environment

### Secrets (set via `wrangler secret put`)

| Name | Value |
|------|-------|
| `MODAL_PROXY_TOKEN` | `wk-...ws-...` (the Proxy Token you created in Modal) |

### Vars (set in `wrangler.toml`)

| Name | Default | Description |
|------|---------|-------------|
| `MODAL_ENDPOINT` | — | **Required.** Your Modal Dedicated Endpoint URL (no trailing `/v1/...`) |
| `MODAL_MODEL` | `qwen-2.5-72b` | Model name the endpoint serves |
| `MODAL_BUDGET_USD` | `50` | Monthly budget cap (shown as balance in the UI) |
| `MODAL_IN_PRICE` | `0.12` | Per-1M input-token price in USD |
| `MODAL_OUT_PRICE` | `0.36` | Per-1M output-token price in USD |

> **Dedicated Endpoints** bill per compute-second, not per token. The
> `MODAL_IN_PRICE` / `MODAL_OUT_PRICE` values are used for an *estimated*
> per-request cost — adjust them to approximate your actual billing rate.

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
npx wrangler dev       # → http://localhost:8787 (with Durable Objects in --local mode)
```

## How it works

1. **`POST /api/advise`** — The browser sends the OpenAI-compatible Chat
   Completions body (without a model name). The worker injects `model` from
   env, sets `Authorization: Bearer <proxy-token>`, and streams the Modal
   response back to the browser verbatim. After the stream ends, it appends
   one extra SSE event:

   ```
   data: {"type":"usage","usage":{...},"costUsd":0.000312,"balanceUsd":49.97}
   ```

   The frontend reads this to show per-request cost and remaining balance.

2. **`GET /api/balance`** — Returns the Durable Object ledger:

   ```json
   { "budgetUsd": 50, "spentUsd": 0.03, "balanceUsd": 49.97, "currency": "usd" }
   ```

3. **Durable Object (`BalanceDO`)** — A single-instance DO keyed
   `"luxmi-budget"` that persists `spentUsd` across requests. The `/incr`
   endpoint adds a cost; `/get` reads the ledger.

## CORS

All responses include `Access-Control-Allow-Origin: *`. The worker serves
GitHub Pages at `https://evolvedhow.github.io`.
