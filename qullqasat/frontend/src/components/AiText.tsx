/**
 * Texto generado por IA: Markdown mínimo y seguro (sin innerHTML) + animación de escritura.
 * Soporta: "## Título", viñetas (-, *, •, 1.), **negrita**, *cursiva*. Todo lo demás se muestra como texto plano.
 * Ver docs/ESTILO.md › Explicación con IA.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/** Quita marcadores sin cerrar (útil mientras el texto aún se está "escribiendo"). */
function closeDangling(line: string): string {
  let s = line
  if ((s.match(/\*\*/g) ?? []).length % 2 === 1) s = s.replace(/\*\*(?!.*\*\*)/, '')
  if ((s.replace(/\*\*/g, '').match(/\*/g) ?? []).length % 2 === 1) s = s.replace(/\*(?!.*\*)/, '')
  return s
}

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={`${key}-b${i}`}>{m[1]}</strong>)
    else if (m[2] !== undefined) out.push(<em key={`${key}-i${i}`}>{m[2]}</em>)
    else out.push(m[3])
    last = re.lastIndex
    i += 1
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Convierte el Markdown del modelo en bloques React con estilo propio. */
function renderAiMarkdown(text: string, caret = false): ReactNode {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: ReactNode[] } | null = null
  const flush = () => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul'
      blocks.push(<Tag key={`l${blocks.length}`}>{list.items}</Tag>)
      list = null
    }
  }
  const lastIdx = lines.length - 1
  lines.forEach((raw, n) => {
    const line = closeDangling(raw.trimEnd())
    const tail = caret && n === lastIdx ? <span className="caret" /> : null
    if (!line.trim()) {
      flush()
      return
    }
    const h = line.match(/^\s*#{1,6}\s+(.*)$/) ?? line.match(/^\s*\*\*([^*]+?):?\*\*\s*:?\s*$/)
    if (h) {
      flush()
      blocks.push(
        <h4 key={`h${n}`} className="ai-h">
          {inline(h[1].replace(/:$/, ''), `h${n}`)}
          {tail}
        </h4>,
      )
      return
    }
    const li = line.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/)
    if (li) {
      const ordered = Boolean(li[1])
      if (!list || list.ordered !== ordered) {
        flush()
        list = { ordered, items: [] }
      }
      list.items.push(
        <li key={`i${n}`}>
          {inline(li[2], `i${n}`)}
          {tail}
        </li>,
      )
      return
    }
    flush()
    blocks.push(
      <p key={`p${n}`}>
        {inline(line.trim(), `p${n}`)}
        {tail}
      </p>,
    )
  })
  flush()
  return blocks
}

/**
 * Escribe el texto palabra por palabra, como una persona tecleando.
 * Duración total acotada (≈ 4–5 s); con "reducir movimiento" aparece completo;
 * el texto animado es aria-hidden y los lectores de pantalla reciben el texto completo una sola vez.
 */
export function AiTypewriter({ text, skipLabel }: { text: string; skipLabel: string }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text])
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setCount(tokens.length)
      return
    }
    setCount(0)
    const words = Math.ceil(tokens.length / 2)
    const delay = Math.max(25, Math.min(70, 5000 / Math.max(1, words)))
    const id = window.setInterval(() => {
      setCount((c) => {
        const next = c + 2 // palabra + espacio
        if (next >= tokens.length) window.clearInterval(id)
        return Math.min(next, tokens.length)
      })
    }, delay)
    return () => window.clearInterval(id)
  }, [tokens])

  const done = count >= tokens.length
  return (
    <>
      <div className="typed ai-md" aria-hidden="true">
        {renderAiMarkdown(tokens.slice(0, count).join(''), !done)}
      </div>
      <div className="sr-only">{text.replace(/[#*`]/g, '')}</div>
      {!done && (
        <button type="button" className="link-btn" onClick={() => setCount(tokens.length)}>
          {skipLabel}
        </button>
      )}
    </>
  )
}

/** Bloque completo de respuesta: etiqueta de IA + texto animado. */
export function AiAnswer({ text, label, skipLabel, compact = false }: {
  text: string
  label: string
  skipLabel: string
  compact?: boolean
}) {
  return (
    <div className={`ai-answer ${compact ? 'compact' : ''}`}>
      <p className="ai-label">
        <span className="ai-spark" aria-hidden="true">✦</span> {label}
      </p>
      <AiTypewriter text={text} skipLabel={skipLabel} />
    </div>
  )
}
