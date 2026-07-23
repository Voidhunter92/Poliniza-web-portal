# Desplegar Poliniza en Coolify (VPS Hostinger)

Este sitio ahora es una aplicación Node.js (antes era HTML estático), porque
el Portal de clientes necesita un servidor real para manejar el login de
forma segura. Se despliega con el `Dockerfile` incluido en la raíz del
proyecto.

## 1. Crear el recurso en Coolify

1. En Coolify, creá un nuevo **Resource → Application** apuntando a este
   repositorio Git (subí este proyecto a un repo si todavía no lo hiciste).
2. **Build Pack**: `Dockerfile` (Coolify lo detecta automáticamente al ver
   el `Dockerfile` en la raíz).
3. **Puerto**: `3000` (ya está expuesto en el Dockerfile).

## 2. Variables de entorno

En la sección *Environment Variables* de Coolify, definí:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

No hace falta definir `SESSION_SECRET` a mano: el servidor genera una clave
aleatoria sola la primera vez que arranca y la guarda en
`server/data/session-secret.txt` (por eso ese archivo tiene que vivir en el
volumen persistente del punto 3 — si no, cada redeploy generaría una clave
nueva y cerraría la sesión de todos los usuarios logueados).

## 3. Volúmenes persistentes (IMPORTANTE)

Sin esto, cada vez que redeployes vas a **perder todas las cuentas de
clientes que hayas creado, los informes subidos y el contenido de CENOA**,
porque Docker reconstruye el contenedor desde cero en cada deploy.

En Coolify, agregá dos *Persistent Storage* (volúmenes) para esta app:

| Ruta dentro del contenedor | Qué guarda |
|---|---|
| `/app/server/data` | Usuarios, informes asignados, contenidos de CENOA, sesiones |
| `/app/server/uploads` | Los archivos PDF que suba el administrador |

Coolify se encarga de mapearlos a una carpeta del VPS que persiste entre
despliegues.

## 4. Primer arranque

La primera vez que el contenedor arranca (con `server/data` vacío), el
servidor crea automáticamente estas 3 cuentas:

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Poliniza.Marketing.333` | Administrador |
| `parequipamientos` | `par2026` | Cliente |
| `cenoa` | `cenoa2026` | CENOA |

**Recomendación de seguridad:** entrá como `admin` y usá "Cambiar
contraseña" (arriba a la derecha) para cambiar la contraseña del admin por
una que solo vos conozcas, apenas el sitio esté online. Las contraseñas de
`parequipamientos` y `cenoa` también se pueden cambiar en cualquier momento
desde **Portal → Clientes → Editar**.

## 5. HTTPS

Coolify + Traefik ya manejan el certificado SSL automáticamente si le
asignás un dominio. Es importante que el sitio quede servido por **HTTPS**
en producción: las cookies de sesión del portal están configuradas para
viajar solo por conexiones seguras cuando `NODE_ENV=production` (así nadie
puede interceptar una sesión de login en una red wifi pública, por
ejemplo).

## 6. Actualizar el sitio

Cada vez que hagas cambios y quieras subirlos: hacé push al repo Git y
volvé a desplegar desde Coolify (o activá el auto-deploy por webhook). Los
datos del portal (clientes, informes, CENOA) **no se pierden** porque viven
en los volúmenes persistentes del punto 3, separados del código.
