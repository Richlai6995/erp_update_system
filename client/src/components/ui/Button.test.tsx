import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'
import { describe, it, expect, vi } from 'vitest'

describe('Button', () => {
    it('renders correct text', () => {
        render(<Button>Click me</Button>)
        expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    it('handles onClick', () => {
        const handleClick = vi.fn()
        render(<Button onClick={handleClick}>Click me</Button>)
        fireEvent.click(screen.getByText('Click me'))
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('shows loading state', () => {
        render(<Button isLoading>Click me</Button>)
        expect(screen.getByRole('button')).toBeDisabled()
        // Check for loader if possible, or just disabled
    })
})
