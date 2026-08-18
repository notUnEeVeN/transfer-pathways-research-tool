import React from 'react'
import { Alert, Button } from './ui'

/**
 * Catches a render error so it lands as a message instead of a white screen.
 *
 * React unmounts the whole tree when a render throws and nothing catches it,
 * which in a single-page console means the entire app disappears and the only
 * recovery is a reload — with the error visible solely in the developer tools,
 * where nobody is looking. That is a bad trade in a research tool: one figure
 * hitting an unexpected shape should cost that figure, not the page and not
 * whatever the reader had assembled around it.
 *
 * `scope` names what failed so the message can say which part died, and
 * `onReset` (with a changing `resetKey`) lets a caller offer a way back
 * without a reload.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Kept: the stack is the only place the component path survives, and this
    // is an internal tool where the console is a legitimate audience.
    console.error(`[${this.props.scope || 'app'}] render failed`, error, info?.componentStack)
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const { scope = 'This view', onReset } = this.props
    return (
      <Alert type='error'>
        <div className='flex flex-col items-start gap-2'>
          <p>{scope} could not be displayed.</p>
          <p className='text-caption font-mono break-all'>{String(error?.message || error)}</p>
          {onReset && (
            <Button size='sm' variant='secondary' onClick={() => {
              this.setState({ error: null })
              onReset()
            }}>Try again</Button>
          )}
        </div>
      </Alert>
    )
  }
}
