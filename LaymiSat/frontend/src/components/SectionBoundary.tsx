import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  message: string
  /** Cambia al recargar datos: permite que la sección se recupere sola. */
  resetKey?: unknown
}

interface State {
  failed: boolean
}

/** Si una sección falla al dibujarse, muestra un aviso en su lugar y el resto de la página sigue visible. */
export default class SectionBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('LaymiSat section error:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (this.state.failed) return <div className="error">{this.props.message}</div>
    return this.props.children
  }
}
