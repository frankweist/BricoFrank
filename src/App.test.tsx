import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import App from './App'

describe('App', () => {
  it('renderiza el tÃƒÂ­tulo', () => {
    render(<App />)
    expect(screen.getByText('Gestor de Reparaciones')).toBeInTheDocument()
  })
})



