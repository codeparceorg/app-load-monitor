# CPU & Memory Load Monitor

Frontend estático para simular una carga creciente de CPU y memoria desde el navegador.

## Ejecutar con Docker

```bash
docker build -t load-monitor .
docker run --rm  --name load-monitor  --cpus=0.25  --memory=512m  -e TARGET_CPU=50  -e TARGET_MEMORY=50  -p 8080:80  load-monitor
```

Abrir:

http://127.0.0.1:8080

## Importante

El porcentaje mostrado es un **objetivo de carga**, no una medición real del porcentaje
de CPU/memoria del sistema. Un navegador no puede conocer de forma fiable el uso global
de CPU/RAM del host mediante JavaScript estándar.

La aplicación usa Web Workers para generar CPU y `ArrayBuffer` para mantener memoria
asignada. El resultado real depende del navegador, número de cores, RAM disponible y
límites de Docker/host.
