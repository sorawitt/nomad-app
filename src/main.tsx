import { render } from 'preact'
import { Route, Switch } from 'wouter-preact'
import './styles/index.css'

function Home() {
  return (
    <main class="mx-auto max-w-screen-sm p-4">
      <h1 class="text-xl font-semibold">Nomad</h1>
      <p class="text-sm text-zinc-500">Bun + Vite + Preact + Tailwind v4</p>
      <div class="@container mt-4">
        <div class="grid grid-cols-1 @min-md:grid-cols-2 gap-3">
          <article class="rounded-xl border p-3">Trip A</article>
          <article class="rounded-xl border p-3">Trip B</article>
        </div>
      </div>
    </main>
  )
}

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route>404</Route>
    </Switch>
  )
}

render(<App />, document.getElementById('app')!)
