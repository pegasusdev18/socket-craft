import { readdirSync, existsSync } from 'node:fs'
import { join, extname, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export class Router {
  constructor(directory) {
    this.directory = directory
    this.routes = new Map()
  }

  async load() {
    if (!existsSync(this.directory)) {
      console.warn(`[SocketCraft] sockets directory not found: ${this.directory}`)
      return
    }
    const files = this.#collect(this.directory)
    for (const file of files) {
      const namespace = this.#toNamespace(file)
      const module = await import(pathToFileURL(file).href)
      this.routes.set(namespace, module)
    }
  }

  #collect(dir) {
    let results = []
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        results = results.concat(this.#collect(fullPath))
      } else if (extname(entry.name) === '.js') {
        results.push(fullPath)
      }
    }
    return results
  }

  #toNamespace(file) {
    const rel = relative(this.directory, file)
    const withoutExt = rel.slice(0, -extname(rel).length)
    const normalized = withoutExt.split(sep).join('/')
    return normalized === 'index' ? '/' : `/${normalized}`
  }

  getNamespace(namespace) {
    return this.routes.get(namespace)
  }

  hasNamespace(namespace) {
    return this.routes.has(namespace)
  }

  getNamespaces() {
    return [...this.routes.keys()]
  }
}
