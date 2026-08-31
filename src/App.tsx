import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          claude-design-experiment
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          React + TypeScript + Tailwind CSS, running on Vite.
        </p>
        <button
          onClick={() => setCount((c) => c + 1)}
          className="mt-6 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          count is {count}
        </button>
      </div>
    </main>
  )
}

export default App
