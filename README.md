# App del Planificador Profesional de Inmigración 2027

Sitio estático (sin compilación) conectado a Supabase, el proyecto `planificador-profesional`.

## Archivos
- `index.html`, `styles.css`: la pantalla de acceso y la app
- `auth.js`: inicio de sesión, activación con el código del libro y vencimiento de la edición
- `planner.js`: las herramientas del planner; guarda cada entrada en la tabla `planner_docs`
- `data/`: contenido (cápsulas, micro-lecciones, vocabulario y estructura de las herramientas)
- `config.js`: dirección de Supabase y llave pública. Esta llave puede estar en el código: la seguridad la dan las reglas RLS de la base de datos.

## Publicar
1. GitHub → repositorio `planificador-app` → **Add file → Upload files**. Arrastra todo el contenido de esta carpeta (no la carpeta misma) → **Commit changes**.
2. Vercel → **Add New → Project** → elige `planificador-app` → Framework: **Other** → **Deploy**.
3. Supabase → **Authentication → URL Configuration**:
   - **Site URL:** la dirección que te dio Vercel (o tu dominio, por ejemplo `https://app.lcdajessicalperezsalazar.com`)
   - **Redirect URLs:** la misma dirección seguida de `/**`
4. (Opcional) En Vercel, en **Settings → Domains**, agrega `app.lcdajessicalperezsalazar.com` y crea en tu proveedor de dominio el registro CNAME que Vercel te indique.

## Acceso de las lectoras y los lectores
- Códigos: `PLANIFICADOR2027` (español) y `PLANNER2027` (inglés). Vencen el 31 de enero de 2028.
- La verificación pide una palabra de una página del libro. Las preguntas se cargan en la tabla `verify_questions` cuando la paginación del libro sea definitiva.
