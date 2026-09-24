// send-feedback — reenvía el Feedback de la app a Discord.
//
// Antes el webhook de Discord viajaba (en base64) dentro del JS público, así que cualquiera
// podía leerlo y publicar en el canal. Ahora la URL vive SOLO como secret de esta función
// (DISCORD_WEBHOOK_URL) y aquí se valida/sanea lo que se reenvía:
//   - se reconstruye el embed campo por campo (nada de payload libre),
//   - allowed_mentions vacío (no se puede hacer @everyone / @rol),
//   - límites de tamaño, de imágenes y freno por IP.
//
// Deploy con verify_jwt = true: el Feedback también se usa sin sesión, pero siempre con la
// llave anónima (JWT válido) en Authorization; así se descartan llamadas ajenas.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const MAX_FILES = 4
const MAX_FILE_BYTES = 4 * 1024 * 1024
const cut = (v: unknown, n: number) => String(v ?? '').slice(0, n)

const hits = new Map<string, number[]>()
function tooMany(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > 5
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405)

  const webhook = Deno.env.get('DISCORD_WEBHOOK_URL') ?? ''
  if (!webhook.startsWith('https://discord.com/api/webhooks/')) {
    console.error('send-feedback: falta el secret DISCORD_WEBHOOK_URL')
    return json({ ok: false, error: 'Feedback no configurado' }, 500)
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (tooMany(ip)) return json({ ok: false, error: 'Demasiados envíos. Espera un minuto.' }, 429)

  try {
    const form = await req.formData()
    const raw = JSON.parse(String(form.get('payload_json') ?? '{}'))
    const src = Array.isArray(raw.embeds) ? raw.embeds[0] ?? {} : {}

    const files = [...form.entries()]
      .filter(([k, v]) => k.startsWith('files[') && v instanceof File)
      .map(([, v]) => v as File)
      .slice(0, MAX_FILES)
    for (const f of files) {
      if (!f.type.startsWith('image/') || f.size > MAX_FILE_BYTES) {
        return json({ ok: false, error: 'Solo se permiten imágenes de hasta 4 MB' }, 400)
      }
    }

    const description = cut(src.description, 3800)
    if (!description.trim()) return json({ ok: false, error: 'Mensaje vacío' }, 400)

    const embed: Record<string, unknown> = {
      title: cut(src.title, 250),
      description,
      color: Number.isInteger(src.color) ? src.color : 3447003,
      fields: (Array.isArray(src.fields) ? src.fields : []).slice(0, 12).map((f: any) => ({
        name: cut(f?.name, 250) || '—',
        value: cut(f?.value, 1000) || '—',
        inline: !!f?.inline,
      })),
      footer: { text: cut(src.footer?.text, 100) },
      timestamp: new Date().toISOString(),
    }
    if (files.length > 0) embed.image = { url: 'attachment://image_0.png' }

    const out = new FormData()
    out.append('payload_json', JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }))
    files.forEach((f, i) => out.append(`files[${i}]`, f, `image_${i}.png`))

    const res = await fetch(webhook, { method: 'POST', body: out })
    if (!res.ok) {
      console.error('send-feedback: Discord respondió', res.status, await res.text())
      return json({ ok: false, error: 'No se pudo entregar el mensaje' }, 502)
    }
    return json({ ok: true })
  } catch (e) {
    console.error('send-feedback error:', e)
    return json({ ok: false, error: 'Solicitud inválida' }, 400)
  }
})
