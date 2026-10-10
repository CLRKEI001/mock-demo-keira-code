// supabase/functions/send-push/index.ts
//
// Sends a Web Push notification to every device a user has subscribed
// (rows in `push_subscriptions`, saved by src/services/push.js).
//
// Body: { userId: string, title: string, body: string, url?: string }
//
// Deploy (JWT verification ON — only signed-in users can call it):
//   supabase functions deploy send-push
// Secrets:
//   supabase secrets set VAPID_PUBLIC_KEY=...  VAPID_PRIVATE_KEY=...
//   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
//   (generate the pair once with: npx web-push generate-vapid-keys;
//    the public key is also REACT_APP_VAPID_PUBLIC_KEY in the app's .env)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

// @ts-ignore -- Deno remote imports aren't resolved by a local TS toolchain
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import webpush from "npm:web-push@3.6.7";

// @ts-ignore -- Deno global
const env = (k: string) => Deno.env.get(k) ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const pub = env("VAPID_PUBLIC_KEY");
  const priv = env("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return json({ error: "VAPID keys are not configured" }, 500);
  webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:admin@example.com", pub, priv);

  let payload: { userId?: string; title?: string; body?: string; url?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { userId, title, body, url } = payload;
  if (!userId || !title) return json({ error: "userId and title are required" }, 400);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) return json({ error: error.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, note: "user has no subscribed devices" });

  const message = JSON.stringify({ title, body: body ?? "", url: url ?? "/" });
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message);
        sent++;
      } catch (e: any) {
        // 404/410 = the device unsubscribed; clean the row up.
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint);
        else console.error("push failed", e?.statusCode, e?.body);
      }
    })
  );
  if (dead.length) await db.from("push_subscriptions").delete().in("endpoint", dead);

  return json({ sent, removed: dead.length });
});