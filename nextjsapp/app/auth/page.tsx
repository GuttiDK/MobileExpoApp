'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/authContext'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(name, email, password)
      }
      router.replace('/houses')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noget gik galt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-5xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-slate-100">HomeApp</h1>
          <p className="text-slate-400 mt-1">Smart home sensor monitoring</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
          <div className="flex rounded-xl bg-slate-900 p-1 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Log ind
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Opret konto
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Navn</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Dit navn"
                  required
                  className="w-full bg-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="din@email.dk"
                required
                className="w-full bg-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 border border-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Adgangskode</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 border border-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Indlæser...' : mode === 'login' ? 'Log ind' : 'Opret konto'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
