import { describe, test, expect } from 'vitest'
import axios from 'axios'
import { extractErrorMessage } from '../api/client'

describe('extractErrorMessage', () => {
  test('returns fallback for a plain Error', () => {
    expect(extractErrorMessage(new Error('oops'), 'fallback')).toBe('fallback')
  })

  test('returns fallback for null', () => {
    expect(extractErrorMessage(null, 'default error')).toBe('default error')
  })

  test('returns fallback for axios error with no response', () => {
    const err = new axios.AxiosError('Network Error')
    expect(extractErrorMessage(err, 'fallback')).toBe('fallback')
  })

  test('returns error message from axios response data', () => {
    const err = new axios.AxiosError('Bad Request')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    err.response = { data: { error: 'title is required' }, status: 400 } as any
    expect(extractErrorMessage(err, 'fallback')).toBe('title is required')
  })

  test('returns fallback when response data has no error field', () => {
    const err = new axios.AxiosError('Bad Request')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    err.response = { data: {}, status: 400 } as any
    expect(extractErrorMessage(err, 'fallback')).toBe('fallback')
  })
})
