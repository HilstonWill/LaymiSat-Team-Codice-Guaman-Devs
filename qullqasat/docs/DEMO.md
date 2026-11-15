# Guion de demo (2 min) y pitch actualizado con datos reales

> **Vista MVP:** por defecto la app muestra solo lo que responde al problema (mapa + ficha, 3 alertas, ¿a qué altura hiela?, calendario de Guaman Poma, rotaciones con el resultado primero, fuentes; la evidencia de 40 años y la personalización de rotaciones van plegadas). El simulador de fecha, el pronóstico de 7 días, la IA y el panel NDVI están ocultos, no borrados: se ven con `?full=1` (ver `frontend/src/features.ts`).

## Demo en vivo (2 minutos)
1. **(0:00) Problema.** "En Pisac, a 3.900 m, la papa nativa depende de sembrar en el momento justo. Guaman Poma lo escribió en 1615: en Coya Raymi (septiembre) se siembra el maíz y la papa temprana, y en Capac Inti Raymi (diciembre) la papa, la oca, la quinua y el maíz de temporal (manuscrito, págs. 1165 y 1174)."
2. **(0:15) Mapa 3D + ficha de la zona.** Dejar que la intro vuele del globo a los Andes. Activar **NDVI · MODIS** un segundo (es un dato NASA en vivo) y volver a Satélite. Elegir *Parque de la Papa (Pisac)*. Mostrar que las noches se calientan **+0,19 °C/década (p < 0,001)** y que la lluvia firme llega en promedio el **19 de octubre**, en una ventana del **26 sep al 13 nov**: no hay una fecha fija.
3. **(0:40) Las 3 alertas.** AHS en rojo (helada en brotación en el 93 % de las campañas a 3.900 m), AEH y ADS con su detonador y su tendencia.
4. **(1:00) ¿A qué altura hiela?** Leer la frase de arriba del gráfico (la franja de la parcela y desde qué altura casi no hiela) y mover el deslizador de altitud a 3.600 m: la helada pasa a verde.
5. **(1:15) Calendario de Guaman Poma.** Los 12 meses medidos con su variable NASA: qué se mantiene y qué cambió. Somos honestos: no forzamos que el códice "falle".
6. **(1:30) Rotaciones.** Las 3 tarjetas de resultado: la acortada actual es *Riesgosa* (débil en suelo y plagas) y la alternativa con tarwi y haba es la *Mejor opción*. Si hay tiempo, abrir "Personalizar mi rotación" y cambiar el año 2 a tarwi. Decirlo como herramienta para conversar en asamblea, no como recomendación técnica.
7. **(1:50) Imprimir ficha y panel de límites.** "No predecimos cosechas: damos evidencia a la asamblea comunal."

## Pitch de 30 s (inglés)
"In the high Andes of Cusco, native potato farmers still sow by a calendar written in 1615 by Guaman Poma de Ayala. We tested it against 40 years of NASA POWER data. Nights are warming about 0.2 °C per decade, the frost line for sprouting potatoes now sits between 3,600 and 3,800 meters, and the firm rains now arrive anywhere in a seven-week window between late September and mid-November. LaymiSat turns this into three plain-language alerts (frost, drought stress and calendar shift) for any plot and altitude, and compares crop rotations so communities can choose. Ancestral wisdom, checked by space data."

> Cifras de Pisac a 3.900 m (celda POWER −13,5°, −71,875°). Se recalculan en vivo para cada zona y pueden variar un poco cuando se actualiza la caché.
