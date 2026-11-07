---
name: clima
description: Consulta el clima actual y el pronóstico de la ubicación local del usuario (detectada por IP) o de una ciudad indicada, usando wttr.in sin API key. Usar cuando el usuario pida el clima, el tiempo, la temperatura, si va a llover o el pronóstico, o invoque /clima.
argument-hint: "[ciudad] [hoy|pronostico]"
allowed-tools: Bash(curl:*)
---

# Clima

Obtiene el clima con `curl` contra https://wttr.in. No requiere API key ni dependencias.

## Ubicación

- Sin argumentos: usar la ubicación local. wttr.in la detecta por la IP pública (ruta vacía `wttr.in/`).
- Con ciudad en `$ARGUMENTS`: usarla en la ruta, cambiando espacios por `+` (ej. `Bogota`, `Santa+Marta`, `Madrid,Spain`).

## Comandos

Clima actual (una línea). Usar siempre `-s`, `--max-time 15`, `lang=es` y `m` (unidades métricas):

```bash
curl -s --max-time 15 "https://wttr.in/<CIUDAD>?format=%l:+%c+%C,+%t+(sensaci%C3%B3n+%f),+humedad+%h,+viento+%w,+lluvia+%p&lang=es&m"
```

Pronóstico de 3 días (JSON, para resumir):

```bash
curl -s --max-time 15 "https://wttr.in/<CIUDAD>?format=j1&lang=es&m"
```

Del JSON usar: `current_condition[0]` (actual), `weather[i].date`, `maxtempC`, `mintempC`, `hourly[*].chanceofrain` y `hourly[*].lang_es[0].value` (descripción).

## Pasos

1. Si el usuario pide solo el clima actual, ejecutar el comando de una línea.
2. Si pide pronóstico, lluvia, "mañana" o "esta semana", ejecutar el comando JSON.
3. Responder en español, breve: ubicación, estado, temperatura, sensación térmica, humedad, viento y precipitación (`%p` es mm caídos, no probabilidad). Para pronóstico, una línea por día con mínima/máxima y máxima probabilidad de lluvia.

## Errores

- Respuesta vacía, timeout o texto con `Unknown location`: avisar al usuario y pedir una ciudad explícita.
- La ubicación por IP puede ser imprecisa (VPN, proxy). Mostrar siempre la ubicación detectada para que el usuario la confirme.
