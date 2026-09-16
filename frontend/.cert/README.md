# Certificado HTTPS de desarrollo

Este certificado es autofirmado y **solo para pruebas locales** (para que la
camara del navegador y `crypto.randomUUID()` funcionen al abrir la app desde
el telefono por la red local — ambos requieren HTTPS o `localhost`). No se
usa en produccion; ahi el HTTPS lo da el hosting real.

Esta carpeta esta en `.gitignore`: cada quien genera el suyo. Si `vite.config.js`
no encuentra `dev-key.pem`/`dev-cert.pem` aqui, simplemente sigue en HTTP
normal (la camara en vivo no funcionara desde el telefono hasta generarlo,
pero "Subir imagen" si sigue funcionando).

## Generar el certificado

Necesita `openssl` instalado. Reemplace `192.168.0.104` por la IP que le
muestre `npm run dev` bajo "Network" (cambia si cambia de red/router):

```bash
mkdir -p .cert && cd .cert
cat > san.cnf <<'EOF'
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = Hospital Verapaz Dev

[v3_req]
keyUsage = keyEncipherment, dataEncipherment, digitalSignature
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = 192.168.0.104
EOF
openssl req -x509 -nodes -newkey rsa:2048 -keyout dev-key.pem -out dev-cert.pem -days 825 -config san.cnf
```

Reinicie `npm run dev`. La primera vez que abra `https://<su-ip>:5173` en la
computadora y en el telefono, el navegador va a advertir "conexion no
segura" (es normal, el certificado no esta firmado por una autoridad
reconocida) — hay que aceptar la excepcion ("Avanzado" -> "Continuar de
todas formas") una vez por dispositivo.
