# M-Pesa STK Push testing website

A small Node.js + Express website for testing **Safaricom Daraja STK Push in the sandbox**.

## Deploy on Render

1. Push this folder to a GitHub repository.
2. In Render choose **New > Web Service** and connect the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add these environment variables in Render:

| Variable | Value |
|---|---|
| `CONSUMER_KEY` | Consumer Key from your Daraja sandbox app |
| `CONSUMER_SECRET` | Consumer Secret from your Daraja sandbox app |
| `SHORTCODE` | Sandbox shortcode, usually `174379` |
| `PASSKEY` | STK Push passkey from Daraja sandbox |
| `CALLBACK_URL` | `https://YOUR-RENDER-SERVICE.onrender.com/mpesa/callback` |

Do not commit real credentials to GitHub. Keep them in Render Environment settings.

## Test

Open your Render service URL. Enter a Safaricom number and an amount, then press **Pay with M-Pesa**. The website calls `POST /api/stkpush`. The server sends the request to the Daraja sandbox. Callback results are logged in the Render service logs.

Health check: `GET /health`

Callback: `POST /mpesa/callback`

## Important

- This is a sandbox example, not a production payment system.
- Use sandbox credentials and follow Daraja's sandbox test-number instructions.
- The callback URL must be publicly accessible over HTTPS.
- Callback details are logged only; this demo does not store orders or provide production-grade reconciliation.
- No STK request is sent just because the server starts.
- The app uses Render's `PORT` environment variable.
