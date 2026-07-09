import { readdirSync, existsSync } from 'node:fs'
import { join, extname, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const IGNORED_PATTERN = /\.(test|spec)\.js$/i
const DYNAMIC_SEGMENT_PATTERN = /^\[(.+)\]$/

export class Router {
  constructor(directory) {
    this.directory = directory
    this.staticRoutes = new Map()
    this.dynamicRoutes = []
  }

  async load() {
    if (!existsSync(this.directory)) {
      console.warn(`[SocketCraft] sockets directory not found: ${this.directory}`)
      return
    }
    const files = this.#collect(this.directory)
    for (const file of files) {
      const namespace = this.#toNamespace(file)
      let module
      try {
        module = await import(pathToFileURL(file).href)
      } catch (error) {
        console.warn(`[SocketCraft] Failed to import module: ${file} (${error.message})`)
        continue
      }
      if (!this.#isValidModule(module)) {
        console.warn(`[SocketCraft] Skipping invalid module (no function exports): ${file}`)
        continue
      }
      this.#registerRoute(namespace, module)
    }
    this.dynamicRoutes.sort((a, b) => {
      if (b.segments.length !== a.segments.length) {
        return b.segments.length - a.segments.length
      }
      return a.paramNames.length - b.paramNames.length
    })
  }

  #registerRoute(namespace, module) {
    const segments = namespace === '/' ? [] : namespace.split('/').filter(Boolean)
    const isDynamic = segments.some((segment) => DYNAMIC_SEGMENT_PATTERN.test(segment))
    if (!isDynamic) {
      this.staticRoutes.set(namespace, module)
      return
    }
    const paramNames = []
    const regexParts = segments.map((segment) => {
      const match = segment.match(DYNAMIC_SEGMENT_PATTERN)
      if (match) {
        paramNames.push(match[1])
        return '([^/]+)'
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    const regex = new RegExp(`^/${regexParts.join('/')}$`)
    this.dynamicRoutes.push({ regex, paramNames, module, segments })
  }

  #isValidModule(module) {
    if (!module || typeof module !== 'object') return false
    return Object.values(module).some((value) => typeof value === 'function')
  }

  #isIgnoredName(name) {
    if (name.startsWith('.') || name.startsWith('_')) return true
    return false
  }

  #isValidFile(name) {
    if (extname(name) !== '.js') return false
    if (this.#isIgnoredName(name)) return false
    if (IGNORED_PATTERN.test(name)) return false
    return true
  }

  #collect(dir) {
    let results = []
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (this.#isIgnoredName(entry.name)) continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        results = results.concat(this.#collect(fullPath))
      } else if (entry.isFile() && this.#isValidFile(entry.name)) {
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

  match(pathname) {
    const staticModule = this.staticRoutes.get(pathname)
    if (staticModule) {
      return { module: staticModule, params: {} }
    }
    for (const route of this.dynamicRoutes) {
      const result = route.regex.exec(pathname)
      if (result) {
        const params = {}
        route.paramNames.forEach((name, index) => {
          params[name] = decodeURIComponent(result[index + 1])
        })
        return { module: route.module, params }
      }
    }
    return null
  }

  hasRoute(pathname) {
    return this.match(pathname) !== null
  }

  getNamespaces() {
    const staticNames = [...this.staticRoutes.keys()]
    const dynamicNames = this.dynamicRoutes.map((route) => `/${route.segments.join('/')}`)
    return staticNames.concat(dynamicNames)
  }
}
