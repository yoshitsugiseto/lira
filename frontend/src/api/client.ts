import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export default client

/** axiosエラーからAPIのエラーメッセージを取り出す */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && error.response?.data?.error) {
    return String(error.response.data.error)
  }
  return fallback
}
