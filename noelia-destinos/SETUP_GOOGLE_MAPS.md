# Configurar Google Maps Distance Matrix API — 3 minutos

## Paso 1: Ir a Google Cloud Console
Ve a https://console.cloud.google.com/ e inicia sesión con tu cuenta Google.

## Paso 2: Crear proyecto
1. Haz clic en el selector de proyecto (arriba, donde pone "MI_PRIMER_PROYECTO" o similar)
2. Clic en **"Nuevo proyecto"** (arriba a la derecha)
3. Nombre: `cocobot-pages` (o lo que quieras)
4. Clic en **"Crear"**
5. Espera unos segundos y selecciona el proyecto nuevo

## Paso 3: Habilitar la API
1. Ve a https://console.cloud.google.com/apis/library/distancematrix-backend.googleapis.com
2. Clic en **"Habilitar"**

## Paso 4: Crear credencial
1. Ve a https://console.cloud.google.com/apis/credentials
2. Clic en **"+ CREAR CREDENCIALES"** → **"Clave de API"**
3. Se generará una clave como `AIzaSy...`
4. Clic en **"Copiar"** (o selecciónala y Ctrl+C)

## Paso 5: Restringir la clave (opcional pero recomendado)
1. Haz clic en la clave recién creada
2. En "Restricciones de la API", clic en "Restringir clave"
3. Selecciona **"Distance Matrix API"**
4. Guardar

## Paso 6: Pasarme la clave
Pásame la clave por aquí y yo configuro todo.

---

**Nota:** Google da $200/mes gratis. Cada ruta cuesta ~$0.005, así que puedes hacer ~40.000 rutas gratis al mes. Para 70 localidades, cuesta ~$0.35 total.
