import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, PriorityBadge, TypeIcon } from '../components/common/Badge'

describe('StatusBadge', () => {
  test('renders Todo for todo status', () => {
    render(<StatusBadge status="todo" />)
    expect(screen.getByText('Todo')).toBeInTheDocument()
  })

  test('renders In Progress for in_progress status', () => {
    render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  test('renders In Review for in_review status', () => {
    render(<StatusBadge status="in_review" />)
    expect(screen.getByText('In Review')).toBeInTheDocument()
  })

  test('renders Done for done status', () => {
    render(<StatusBadge status="done" />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })
})

describe('PriorityBadge', () => {
  test('renders Critical', () => {
    render(<PriorityBadge priority="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  test('renders High', () => {
    render(<PriorityBadge priority="high" />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  test('renders Medium', () => {
    render(<PriorityBadge priority="medium" />)
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  test('renders Low', () => {
    render(<PriorityBadge priority="low" />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })
})

describe('TypeIcon', () => {
  test('renders Story with title attribute', () => {
    render(<TypeIcon type="story" />)
    expect(screen.getByTitle('Story')).toBeInTheDocument()
  })

  test('renders Task with title attribute', () => {
    render(<TypeIcon type="task" />)
    expect(screen.getByTitle('Task')).toBeInTheDocument()
  })

  test('renders Bug with title attribute', () => {
    render(<TypeIcon type="bug" />)
    expect(screen.getByTitle('Bug')).toBeInTheDocument()
  })

  test('renders Spike with title attribute', () => {
    render(<TypeIcon type="spike" />)
    expect(screen.getByTitle('Spike')).toBeInTheDocument()
  })
})
