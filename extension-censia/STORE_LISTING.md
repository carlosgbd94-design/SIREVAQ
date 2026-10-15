# Ficha de Chrome Web Store — SIREVAQ → CeNSIA

**Nombre:** SIREVAQ → CeNSIA
**Categoría:** Productividad  ·  **Idioma:** Español (México)
**Visibilidad recomendada:** No listada (solo quien tenga el enlace)

## Descripción corta (≤132 caracteres)
Rellena en CeNSIA las dosis de Influenza que ya validaste en SIREVAQ. Tú revisas y pulsas Guardar.

## Descripción detallada
Complemento para las unidades de salud que reportan la campaña de Influenza en SIREVAQ y después deben capturar lo mismo en CeNSIA.

Cómo funciona:
1. En SIREVAQ valida tu reporte semanal y pulsa «Abrir CeNSIA y rellenar».
2. Inicia sesión en CeNSIA como siempre (con tu verificación en 2 pasos).
3. Al entrar a Dosis Aplicadas → Captura, las casillas aparecen rellenas con tus cifras, la unidad y la fecha de aplicación.
4. Revisa y pulsa Guardar tú mismo.

Qué NO hace: no guarda ni envía nada por ti, no ve ni almacena tu usuario o contraseña, no se comunica con ningún servidor y solo actúa en SIREVAQ y en la pantalla de captura de Influenza de CeNSIA.

## Propósito único
Pasar a la pantalla de captura de Influenza de CeNSIA las cifras de dosis que el usuario ya validó en SIREVAQ.

## Justificación de permisos
- **storage:** guarda temporalmente en el navegador (máximo 12 horas) el paquete de cifras que SIREVAQ entrega, hasta que se abre la pantalla de captura de CeNSIA. Se borra al guardar o al expirar.
- **Acceso a sitios** (`carlosgbd94-design.github.io/SIREVAQ/*` y `siscensia.salud.gob.mx/influenza26/ssa/captura.php*`): leer el paquete que entrega SIREVAQ y rellenar las casillas de esa única pantalla de CeNSIA.

## Uso de datos (formulario de privacidad)
- No recopila datos personales, de salud de personas, autenticación ni ubicación.
- Las cifras manejadas son conteos agregados de dosis por grupo de edad; permanecen en el navegador.
- No vende ni transfiere datos a terceros. No usa código remoto.
- URL de política de privacidad: https://carlosgbd94-design.github.io/SIREVAQ/privacidad_complemento_censia.html

## Capturas requeridas
Al menos 1 de 1280×800 (o 640×400): CeNSIA con el aviso «SIREVAQ rellenó N casillas…» (toma en una unidad real, sin datos personales).
