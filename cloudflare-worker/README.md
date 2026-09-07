# AquaDesk AI Worker

This uses the Gemini API through Google AI Studio's free tier with the API key stored as a Cloudflare Worker secret. Do not enable billing or place the key in the React app.

This Worker keeps the Gemini API key out of the React bundle. The key is stored as a Cloudflare secret and must never be committed to this repository.

## Deploy

1. Install Wrangler:

   ```powershell
   npm install -g wrangler
   ```

2. Sign in to Cloudflare:

   ```powershell
   wrangler login
   ```

3. From the `cloudflare-worker` directory, store the Gemini key. Paste the real key only when Wrangler prompts for it:

   ```powershell
   wrangler secret put GEMINI_API_KEY
   ```

4. Deploy the Worker:

   ```powershell
   wrangler deploy
   ```

5. Note the Worker URL printed by Wrangler, such as `https://aquadesk-ai.<subdomain>.workers.dev`.

6. In the React project root, create `.env.local` and set:

   ```text
   REACT_APP_AI_WORKER_URL=https://aquadesk-ai.<subdomain>.workers.dev
   ```

Restart the React development server after changing `.env.local`.
