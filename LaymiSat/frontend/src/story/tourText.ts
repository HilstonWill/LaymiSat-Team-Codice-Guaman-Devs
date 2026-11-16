import type { Lang } from '../i18n'

/** Guía de primer uso (Tour.tsx): textos por pantalla, en inglés (por defecto) y español. */
export type TourView = 'zonas' | 'hoy' | 'rotaciones' | 'calendario' | 'historia'

export type TourIcon =
  | 'welcome'
  | 'tabs'
  | 'map'
  | 'light'
  | 'globe'
  | 'help'
  | 'calendar'
  | 'leaf'
  | 'chart'
  | 'play'
  | 'slider'
  | 'steps'
  | 'check'
  | 'frost'
  | 'list'
  | 'pin'

export interface TourStep {
  id: string
  /** Selector CSS del elemento a resaltar. Sin selector (o si no está visible) la tarjeta va centrada. */
  target?: string
  place?: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  icon: TourIcon
  title: string
  body: string
  tip?: string
}

export interface TourUi {
  next: string
  back: string
  skip: string
  done: string
  start: string
  never: string
  close: string
  step: (i: number, n: number) => string
  help: string
  dialog: Record<TourView, string>
}

export interface TourDict {
  ui: TourUi
  steps: Record<TourView, TourStep[]>
}

const en: TourDict = {
  ui: {
    next: 'Next',
    back: 'Back',
    skip: 'Skip tour',
    done: 'Got it',
    start: 'Start the tour',
    never: "Don't show guides again",
    close: 'Close guide',
    step: (i, n) => `Step ${i} of ${n}`,
    help: 'Replay the guide for this screen',
    dialog: {
      zonas: 'Guide: Zones',
      hoy: 'Guide: Today',
      rotaciones: 'Guide: Rotations',
      calendario: 'Guide: Calendar',
      historia: 'Guide: 40 years',
    },
  },
  steps: {
    zonas: [
      {
        id: 'welcome',
        icon: 'welcome',
        title: 'Welcome to LaymiSat',
        body: "Agroclimatic alerts for native-potato farmers in Cusco, built on 40 years of NASA satellite data and Guaman Poma's 1615 calendar. A 30-second tour shows you how it works.",
      },
      {
        id: 'tabs',
        target: '.story-tabs',
        place: 'bottom',
        icon: 'tabs',
        title: 'Five screens, one story',
        body: 'Zones shows every community. Today tells you what to do this season. Rotations plans what to plant next. Calendar compares Guaman Poma with NASA data. 40 years replays the climate.',
      },
      {
        id: 'map',
        target: '.story-stage',
        place: 'auto',
        icon: 'map',
        title: 'Explore the 3D terrain',
        body: "Each pin is a pilot community, coloured by this season's risk. Drag to look around, use + and − to zoom, and tap a pin to open that community.",
      },
      {
        id: 'list',
        target: '.zone-list',
        place: 'auto',
        icon: 'light',
        title: 'A traffic light per community',
        body: 'Red means act now, amber means keep watch, green means all clear. Tap any card to see exactly what to do and when to sow.',
        tip: 'Communities are sorted with the highest risk first.',
      },
      {
        id: 'zone',
        target: '.story-zone',
        place: 'bottom',
        icon: 'pin',
        title: 'Switch community any time',
        body: 'This selector sets the place used by Today, Rotations, Calendar and 40 years.',
      },
      {
        id: 'lang',
        target: '.story-lang',
        place: 'bottom',
        icon: 'globe',
        title: 'English or Spanish',
        body: 'Change the whole app instantly. Your choice is remembered on this device.',
      },
      {
        id: 'help',
        target: '.story-help',
        place: 'bottom',
        icon: 'help',
        title: 'Need a refresher?',
        body: 'Tap the ? button whenever you want to replay the guide for the screen you are on.',
      },
    ],
    hoy: [
      {
        id: 'decision',
        target: '.hoy-decision',
        place: 'auto',
        icon: 'check',
        title: 'Your decision for this season',
        body: 'A plain-language verdict for the selected community: how risky the season looks and what to do about it.',
      },
      {
        id: 'window',
        target: '.hd-window',
        place: 'auto',
        icon: 'calendar',
        title: 'Your sowing window',
        body: 'The dates when sowing is safest, based on when steady rain usually arrives and when frost is likely.',
      },
      {
        id: 'alerts',
        target: '.today-alerts-sec',
        place: 'auto',
        icon: 'frost',
        title: 'Three alerts: frost, rain, calendar',
        body: 'Each one has its own traffic light. Tap an alert to open the recommended action.',
        tip: 'Frost = cold nights · Sowing rain = enough water to start · Calendar = delay against Coya Raymi.',
      },
      {
        id: 'rotation',
        target: '.today-rot',
        place: 'auto',
        icon: 'leaf',
        title: 'What to plant next',
        body: 'The best-scoring rotation for your area over the coming campaigns. Tap Compare to build and test your own.',
      },
      {
        id: 'scene',
        target: '.scene-today',
        place: 'auto',
        icon: 'map',
        title: 'Frost on the map',
        body: 'Shows the altitude above which it usually freezes and whether your plot sits inside that zone.',
      },
      {
        id: 'why',
        target: '.today-links .btn-cta',
        place: 'auto',
        icon: 'chart',
        title: 'Why this advice?',
        body: 'Replays 40 years of NASA data so you can see the evidence behind every recommendation.',
      },
    ],
    rotaciones: [
      {
        id: 'steps',
        target: '.rpw-steps',
        place: 'bottom',
        icon: 'steps',
        title: 'Plan in four steps',
        body: 'Your rotation → your plot → your goals → your target. The progress bar shows where you are, and you can always go back.',
      },
      {
        id: 'card',
        target: '.rpw-card',
        place: 'auto',
        icon: 'list',
        title: 'Answer in plain choices',
        body: 'Pick your current rotation, describe your slope and soil, then choose what matters most. No technical knowledge needed.',
      },
      {
        id: 'result',
        icon: 'check',
        title: 'You get a target score',
        body: 'At the end you see your score today against the best option, the first change to make, and a one-tap WhatsApp share to discuss with your community.',
        tip: 'Scores are indicative: they help you compare options, they do not predict yield.',
      },
    ],
    calendario: [
      {
        id: 'wheel',
        target: '.gp-wheel',
        place: 'auto',
        icon: 'calendar',
        title: "Guaman Poma's year, as a wheel",
        body: 'Each slice is a month from the 1615 manuscript. Tap one to see what the community did then and what NASA data say now.',
      },
      {
        id: 'legend',
        target: '.gp-legend',
        place: 'auto',
        icon: 'light',
        title: 'Read the colours',
        body: 'Green: it still holds. Amber or red: it changed or does not match. Beige: context only.',
      },
      {
        id: 'detail',
        target: '.gp-detail',
        place: 'auto',
        icon: 'chart',
        title: 'Then versus now',
        body: 'Compare 1984–1998 with 2011–2025 (dry spells, frost, late rain), read what to do this month, and open the original manuscript page.',
      },
    ],
    historia: [
      {
        id: 'stage',
        target: '.story-stage',
        place: 'auto',
        icon: 'map',
        title: '40 seasons on the map',
        body: 'Watch where frost reached each season. The highlighted marker is your plot.',
      },
      {
        id: 'play',
        target: '.tl-play',
        place: 'top',
        icon: 'play',
        title: 'Press play',
        body: 'Replays every campaign from 1984. Use the speed buttons for 2× or 4×.',
      },
      {
        id: 'range',
        target: '.tl-range',
        place: 'top',
        icon: 'slider',
        title: 'Or scrub through the years',
        body: 'Drag to any season, or use the arrow keys to move one season at a time.',
      },
      {
        id: 'charts',
        target: '.tl-charts',
        place: 'top',
        icon: 'chart',
        title: 'Three signals',
        body: 'Delay of the rain, minimum temperature and frost altitude. Tap a bar or a point to jump to that season.',
      },
      {
        id: 'events',
        target: '.events',
        place: 'auto',
        icon: 'list',
        title: 'Key moments',
        body: 'The latest rain, the driest spring, the lowest frost line… tap one to jump straight there.',
      },
    ],
  },
}

const es: TourDict = {
  ui: {
    next: 'Siguiente',
    back: 'Atrás',
    skip: 'Omitir guía',
    done: 'Entendido',
    start: 'Empezar la guía',
    never: 'No volver a mostrar guías',
    close: 'Cerrar guía',
    step: (i, n) => `Paso ${i} de ${n}`,
    help: 'Repetir la guía de esta pantalla',
    dialog: {
      zonas: 'Guía: Zonas',
      hoy: 'Guía: Hoy',
      rotaciones: 'Guía: Rotaciones',
      calendario: 'Guía: Calendario',
      historia: 'Guía: 40 años',
    },
  },
  steps: {
    zonas: [
      {
        id: 'welcome',
        icon: 'welcome',
        title: 'Bienvenido a LaymiSat',
        body: 'Alertas agroclimáticas para quienes cultivan papa nativa en Cusco, con 40 años de datos satelitales de la NASA y el calendario de Guaman Poma (1615). Una guía de 30 segundos te muestra cómo usarla.',
      },
      {
        id: 'tabs',
        target: '.story-tabs',
        place: 'bottom',
        icon: 'tabs',
        title: 'Cinco pantallas, una historia',
        body: 'Zonas muestra todas las comunidades. Hoy dice qué hacer esta campaña. Rotaciones planifica qué sembrar después. Calendario compara a Guaman Poma con los datos NASA. 40 años repite el clima.',
      },
      {
        id: 'map',
        target: '.story-stage',
        place: 'auto',
        icon: 'map',
        title: 'Explora el terreno en 3D',
        body: 'Cada marcador es una comunidad piloto, coloreada según el riesgo de la campaña. Arrastra para mirar, usa + y − para acercar y toca un marcador para abrirla.',
      },
      {
        id: 'list',
        target: '.zone-list',
        place: 'auto',
        icon: 'light',
        title: 'Un semáforo por comunidad',
        body: 'Rojo es actuar ya, ámbar es vigilar y verde es todo en orden. Toca una tarjeta para ver qué hacer y cuándo sembrar.',
        tip: 'Las comunidades se ordenan con el mayor riesgo primero.',
      },
      {
        id: 'zone',
        target: '.story-zone',
        place: 'bottom',
        icon: 'pin',
        title: 'Cambia de comunidad cuando quieras',
        body: 'Este selector define el lugar que usan Hoy, Rotaciones, Calendario y 40 años.',
      },
      {
        id: 'lang',
        target: '.story-lang',
        place: 'bottom',
        icon: 'globe',
        title: 'Español o inglés',
        body: 'Cambia toda la aplicación al instante. Tu elección se recuerda en este dispositivo.',
      },
      {
        id: 'help',
        target: '.story-help',
        place: 'bottom',
        icon: 'help',
        title: '¿Necesitas un repaso?',
        body: 'Toca el botón ? cuando quieras repetir la guía de la pantalla en la que estás.',
      },
    ],
    hoy: [
      {
        id: 'decision',
        target: '.hoy-decision',
        place: 'auto',
        icon: 'check',
        title: 'Tu decisión para esta campaña',
        body: 'Un veredicto en lenguaje simple para la comunidad elegida: qué tan riesgosa se ve la campaña y qué hacer.',
      },
      {
        id: 'window',
        target: '.hd-window',
        place: 'auto',
        icon: 'calendar',
        title: 'Tu ventana de siembra',
        body: 'Las fechas en que sembrar es más seguro, según cuándo suele llegar la lluvia firme y cuándo es probable la helada.',
      },
      {
        id: 'alerts',
        target: '.today-alerts-sec',
        place: 'auto',
        icon: 'frost',
        title: 'Tres alertas: helada, lluvia, calendario',
        body: 'Cada una tiene su semáforo. Toca una alerta para abrir la acción recomendada.',
        tip: 'Helada = noches frías · Lluvia de siembra = agua suficiente para empezar · Calendario = retraso frente a Coya Raymi.',
      },
      {
        id: 'rotation',
        target: '.today-rot',
        place: 'auto',
        icon: 'leaf',
        title: 'Qué sembrar después',
        body: 'La rotación mejor puntuada para tu zona en las próximas campañas. Toca Comparar para armar y probar la tuya.',
      },
      {
        id: 'scene',
        target: '.scene-today',
        place: 'auto',
        icon: 'map',
        title: 'La helada en el mapa',
        body: 'Muestra desde qué altitud suele helar y si tu chacra queda dentro de esa franja.',
      },
      {
        id: 'why',
        target: '.today-links .btn-cta',
        place: 'auto',
        icon: 'chart',
        title: '¿Por qué este consejo?',
        body: 'Repite 40 años de datos NASA para que veas la evidencia detrás de cada recomendación.',
      },
    ],
    rotaciones: [
      {
        id: 'steps',
        target: '.rpw-steps',
        place: 'bottom',
        icon: 'steps',
        title: 'Planifica en cuatro pasos',
        body: 'Tu rotación → tu chacra → tus metas → tu objetivo. La barra muestra dónde vas y siempre puedes volver atrás.',
      },
      {
        id: 'card',
        target: '.rpw-card',
        place: 'auto',
        icon: 'list',
        title: 'Responde con opciones simples',
        body: 'Elige tu rotación actual, describe la ladera y el suelo y marca lo que más te importa. No hace falta saber de técnica.',
      },
      {
        id: 'result',
        icon: 'check',
        title: 'Obtienes un puntaje objetivo',
        body: 'Al final ves tu puntaje de hoy frente a la mejor opción, el primer cambio que hacer y un botón de WhatsApp para conversarlo con tu comunidad.',
        tip: 'Los puntajes son referenciales: sirven para comparar opciones, no predicen el rendimiento.',
      },
    ],
    calendario: [
      {
        id: 'wheel',
        target: '.gp-wheel',
        place: 'auto',
        icon: 'calendar',
        title: 'El año de Guaman Poma, en una rueda',
        body: 'Cada sector es un mes del manuscrito de 1615. Toca uno para ver qué hacía la comunidad y qué dicen hoy los datos NASA.',
      },
      {
        id: 'legend',
        target: '.gp-legend',
        place: 'auto',
        icon: 'light',
        title: 'Lee los colores',
        body: 'Verde: se mantiene. Ámbar o rojo: cambió o no coincide. Beige: solo contexto.',
      },
      {
        id: 'detail',
        target: '.gp-detail',
        place: 'auto',
        icon: 'chart',
        title: 'Antes frente a hoy',
        body: 'Compara 1984–1998 con 2011–2025 (veranillos, heladas, lluvia tardía), lee qué hacer este mes y abre la página original del manuscrito.',
      },
    ],
    historia: [
      {
        id: 'stage',
        target: '.story-stage',
        place: 'auto',
        icon: 'map',
        title: '40 campañas en el mapa',
        body: 'Mira hasta dónde llegó la helada en cada campaña. El marcador resaltado es tu chacra.',
      },
      {
        id: 'play',
        target: '.tl-play',
        place: 'top',
        icon: 'play',
        title: 'Pulsa reproducir',
        body: 'Repite cada campaña desde 1984. Usa los botones de velocidad para 2× o 4×.',
      },
      {
        id: 'range',
        target: '.tl-range',
        place: 'top',
        icon: 'slider',
        title: 'O recorre los años',
        body: 'Arrastra hasta cualquier campaña, o usa las flechas del teclado para avanzar de una en una.',
      },
      {
        id: 'charts',
        target: '.tl-charts',
        place: 'top',
        icon: 'chart',
        title: 'Tres señales',
        body: 'Retraso de la lluvia, temperatura mínima y altitud de la helada. Toca una barra o un punto para saltar a esa campaña.',
      },
      {
        id: 'events',
        target: '.events',
        place: 'auto',
        icon: 'list',
        title: 'Momentos clave',
        body: 'La lluvia más tardía, la primavera más seca, la helada más baja… toca uno para ir directo.',
      },
    ],
  },
}

export const TOUR_TEXT: Record<Lang, TourDict> = { en, es }
