import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '../components/common/Modal'

describe('Modal', () => {
  test('renders title and children', () => {
    render(
      <Modal title="Test Modal" onClose={() => {}}>
        <p>Modal body content</p>
      </Modal>
    )
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal body content')).toBeInTheDocument()
  })

  test('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal title="Test" onClose={onClose}>
        <div />
      </Modal>
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal title="Test" onClose={onClose}>
        <div />
      </Modal>
    )
    const backdrop = container.querySelector('.absolute.inset-0')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('does not call onClose when modal content is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal title="Test" onClose={onClose}>
        <p>Content</p>
      </Modal>
    )
    fireEvent.click(screen.getByText('Content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  test('applies lg size class', () => {
    const { container } = render(
      <Modal title="Large" onClose={() => {}} size="lg">
        <div />
      </Modal>
    )
    expect(container.querySelector('.max-w-3xl')).toBeInTheDocument()
  })

  test('applies sm size class', () => {
    const { container } = render(
      <Modal title="Small" onClose={() => {}} size="sm">
        <div />
      </Modal>
    )
    expect(container.querySelector('.max-w-md')).toBeInTheDocument()
  })
})
