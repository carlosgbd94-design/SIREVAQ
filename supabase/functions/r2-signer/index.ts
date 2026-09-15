import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-folder-path, x-file-content-type",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
};

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Initialise Supabase Client with service_role key to bypass RLS and read credentials
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2. Fetch R2 credentials from DB
    const { data: creds, error: dbError } = await supabaseClient
      .from("r2_credentials")
      .select("*")
      .limit(1)
      .single();

    if (dbError || !creds) {
      throw new Error(`Database error fetching credentials: ${dbError?.message || "No credentials found"}`);
    }

    // 3. Read file and metadata from request
    const contentType = req.headers.get("content-type") || "";

    let fileBody: ArrayBuffer;
    let folderPath: string;
    let fileContentType: string;

    if (contentType.includes("multipart/form-data")) {
      // FormData upload
      const formData = await req.formData();
      const fileEntry = formData.get("file") as File | null;
      folderPath = String(formData.get("folderPath") || "");
      fileContentType = String(formData.get("contentType") || fileEntry?.type || "application/octet-stream");

      if (!fileEntry) {
        throw new Error("No file provided in FormData");
      }
      fileBody = await fileEntry.arrayBuffer();
    } else {
      // Raw binary upload: metadata passed via headers
      folderPath = req.headers.get("x-folder-path") || "";
      fileContentType = req.headers.get("x-file-content-type") || "application/octet-stream";
      fileBody = await req.arrayBuffer();
    }

    if (!folderPath) {
      throw new Error("Missing required parameter: folderPath");
    }

    // 4. Verificación de tamaño de almacenamiento (Límite 9.5 GB)
    const { data: totalSizeBytes, error: rpcError } = await supabaseClient.rpc("get_r2_storage_size");
    if (rpcError) {
      console.warn("Error consultando tamaño de almacenamiento R2:", rpcError);
    } else {
      const currentTotal = Number(totalSizeBytes || 0);
      const newFileSize = fileBody.byteLength;
      const LIMIT_BYTES = 9.5 * 1024 * 1024 * 1024; // 9.5 GB

      if (currentTotal + newFileSize > LIMIT_BYTES) {
        // Registrar notificación en la base de datos
        const msg = `El almacenamiento en Cloudflare R2 ha alcanzado los ${(currentTotal / (1024 * 1024 * 1024)).toFixed(2)} GB. Se bloqueó la subida del archivo '${folderPath.split("/").pop()}' de ${(newFileSize / (1024 * 1024)).toFixed(2)} MB para evitar cargos.`;
        
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
                         <li><strong>Archivo bloqueado:</strong> ${folderPath.split("/").pop()}</li>
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

    // 5. Initialise S3 Client for Cloudflare R2
    const s3 = new S3Client({
      region: "auto",
      endpoint: creds.endpoint,
      credentials: {
        accessKeyId: creds.key_id,
        secretAccessKey: creds.secret_key,
      },
    });

    // Bucket name — corrected to match the actual R2 bucket
    const bucketName = "sirevaq-evidencias";

    // 5. Upload file to R2 directly (server-side, no CORS issues)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: folderPath,
      ContentType: fileContentType,
      Body: new Uint8Array(fileBody),
      ContentLength: fileBody.byteLength,
      // Los archivos se pueden "reemplazar" (mismo Key = misma ruta): sin este header
      // un navegador/CDN puede quedarse sirviendo la copia vieja desde su propio caché
      // en vez de revalidar contra R2, aunque el objeto ya se haya sobrescrito.
      CacheControl: "no-cache, must-revalidate",
    });

    await s3.send(command);

    // 6. Construct public URL
    const publicUrl = `${creds.public_url}/${folderPath}`;

    return new Response(
      JSON.stringify({ ok: true, publicUrl, path: folderPath }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[r2-uploader] Error:", error.name, error.message);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
