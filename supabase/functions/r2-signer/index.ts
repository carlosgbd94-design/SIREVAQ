import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { MAX_BYTES, validarRuta, autorizarSubida } from "./validar.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-folder-path, x-file-content-type",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
};

function responder(cuerpo: Record<string, unknown>, estado: number) {
  return new Response(JSON.stringify(cuerpo), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: estado });
}

// Subidas a Cloudflare R2. Endurecida: valida la ruta y el tipo de archivo, limita el tamaño y exige
// sesión según la carpeta (ver validar.mjs). Mientras R2_ALLOW_ANON no sea "false", las carpetas de
// evidencias aceptan todavía las subidas SIN sesión de los clientes viejos (que no mandan el token);
// al poner el secreto R2_ALLOW_ANON=false se cierran por completo.
Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "PUT") {
    return responder({ ok: false, error: "Método no permitido." }, 405);
  }

  try {
    // Tamaño: se corta antes de leer el cuerpo (el multipart agrega un poco de encabezado).
    const declarado = Number(req.headers.get("content-length") || 0);
    if (declarado > MAX_BYTES + 1024 * 1024) {
      return responder({ ok: false, error: "El archivo pesa más de 40 MB." }, 413);
    }

    // 1. Cliente con service_role: lee credenciales de R2 y el perfil de quien sube.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2. Quién sube: el JWT del usuario (si manda la clave pública como token, cuenta como "sin sesión").
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let usuario: { id: string } | null = null;
    if (token) {
      const { data } = await supabaseClient.auth.getUser(token);
      usuario = data?.user ?? null;
    }
    let rol = "";
    let activo = "";
    if (usuario) {
      const { data: perfil } = await supabaseClient.from("perfiles").select("rol, activo").eq("id", usuario.id).maybeSingle();
      rol = perfil?.rol ?? "";
      activo = perfil?.activo ?? "";
    }

    // 3. Leer archivo y metadatos
    const contentType = req.headers.get("content-type") || "";
    let fileBody: ArrayBuffer;
    let folderPath: string;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const fileEntry = formData.get("file") as File | null;
      folderPath = String(formData.get("folderPath") || "");
      if (!fileEntry) throw new Error("No file provided in FormData");
      fileBody = await fileEntry.arrayBuffer();
    } else {
      // Subida binaria directa: los metadatos vienen en encabezados
      folderPath = req.headers.get("x-folder-path") || "";
      fileBody = await req.arrayBuffer();
    }

    // 4. Ruta, tipo y tamaño
    const ruta = validarRuta(folderPath);
    if (!ruta.ok) return responder({ ok: false, error: ruta.error }, ruta.estado);
    if (fileBody.byteLength === 0) return responder({ ok: false, error: "El archivo está vacío." }, 400);
    if (fileBody.byteLength > MAX_BYTES) return responder({ ok: false, error: "El archivo pesa más de 40 MB." }, 413);

    // 5. Permiso según la carpeta
    const permitirAnonimo = (Deno.env.get("R2_ALLOW_ANON") ?? "true").toLowerCase() !== "false";
    const permiso = autorizarSubida({
      segmentos: ruta.segmentos, extension: ruta.extension, rol, activo, tieneSesion: !!usuario, permitirAnonimo,
    });
    if (!permiso.ok) return responder({ ok: false, error: permiso.error }, permiso.estado);
    if (permiso.anonimo) console.warn("[r2-signer] subida SIN sesión (cliente viejo):", ruta.ruta);

    // 6. Credenciales de R2
    const { data: creds, error: dbError } = await supabaseClient
      .from("r2_credentials")
      .select("*")
      .limit(1)
      .single();

    if (dbError || !creds) {
      throw new Error(`Database error fetching credentials: ${dbError?.message || "No credentials found"}`);
    }

    // 7. Verificación de tamaño de almacenamiento (Límite 9.5 GB)
    const { data: totalSizeBytes, error: rpcError } = await supabaseClient.rpc("get_r2_storage_size");
    if (rpcError) {
      console.warn("Error consultando tamaño de almacenamiento R2:", rpcError);
    } else {
      const currentTotal = Number(totalSizeBytes || 0);
      const newFileSize = fileBody.byteLength;
      const LIMIT_BYTES = 9.5 * 1024 * 1024 * 1024; // 9.5 GB

      if (currentTotal + newFileSize > LIMIT_BYTES) {
        // Registrar notificación en la base de datos
        const msg = `El almacenamiento en Cloudflare R2 ha alcanzado los ${(currentTotal / (1024 * 1024 * 1024)).toFixed(2)} GB. Se bloqueó la subida del archivo '${ruta.ruta.split("/").pop()}' de ${(newFileSize / (1024 * 1024)).toFixed(2)} MB para evitar cargos.`;

        await supabaseClient.from("notificaciones").insert({
          title: "Límite de Almacenamiento Crítico R2",
          message: msg,
          type: "alert",
          target_scope: "ROL",
          target_usuario: "CARLOS_BECERRA"
        });

        // Intentar enviar correo con Resend si está la API key configurada
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "SIREVAQ Storage <storage@sirevaq.com>",
                to: ["carlosgbd94@gmail.com"],
                subject: "⚠️ ALERTA: Límite de Almacenamiento Crítico en SIREVAQ R2",
                html: `<p>Hola Carlos,</p>
                       <p>El almacenamiento de tu bucket en Cloudflare R2 está por alcanzar el límite de la cuota gratuita (<strong>9.5 GB</strong>).</p>
                       <p><strong>Detalles:</strong></p>
                       <ul>
                         <li><strong>Uso actual:</strong> ${(currentTotal / (1024 * 1024 * 1024)).toFixed(3)} GB</li>
                         <li><strong>Archivo bloqueado:</strong> ${ruta.ruta.split("/").pop()}</li>
                         <li><strong>Tamaño del archivo:</strong> ${(newFileSize / (1024 * 1024)).toFixed(2)} MB</li>
                       </ul>
                       <p>Las subidas de archivos se mantendrán suspendidas hasta que liberes espacio o aumentes el límite.</p>`
              })
            });
          } catch (mailErr) {
            console.error("Fallo al enviar correo de alerta:", mailErr);
          }
        }

        throw new Error("Límite de almacenamiento alcanzado (9.5 GB). No se pueden subir más archivos.");
      }
    }

    // 8. Cliente S3 de Cloudflare R2
    const s3 = new S3Client({
      region: "auto",
      endpoint: creds.endpoint,
      credentials: {
        accessKeyId: creds.key_id,
        secretAccessKey: creds.secret_key,
      },
    });

    // Bucket real de evidencias
    const bucketName = "sirevaq-evidencias";

    // 9. Subir a R2 desde el servidor (sin problemas de CORS). El Content-Type sale de la extensión.
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: ruta.ruta,
      ContentType: ruta.mime,
      Body: new Uint8Array(fileBody),
      ContentLength: fileBody.byteLength,
      // Los archivos se pueden "reemplazar" (mismo Key = misma ruta): sin este header
      // un navegador/CDN puede quedarse sirviendo la copia vieja desde su propio caché
      // en vez de revalidar contra R2, aunque el objeto ya se haya sobrescrito.
      CacheControl: "no-cache, must-revalidate",
    });

    await s3.send(command);

    // 10. URL pública
    const publicUrl = `${creds.public_url}/${ruta.ruta}`;

    return responder({ ok: true, publicUrl, path: ruta.ruta }, 200);
  } catch (error) {
    console.error("[r2-uploader] Error:", error.name, error.message);
    return responder({ ok: false, error: error.message }, 400);
  }
});
