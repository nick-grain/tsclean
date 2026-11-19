import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { RuleName } from './rules/index.ts'

export type Config = {
  rules: Partial<Record<RuleName, boolean>>
}

export const defineConfig = (config: Config): Config => config

export const DEFAULT_CONFIG_PATH = join(import.meta.dirname, '..', 'tsclean.config.ts')

export async function loadConfig(path: string = process.env.TSCLEAN_CONFIG ?? DEFAULT_CONFIG_PATH): Promise<Config> {
  if (!existsSync(path)) return { rules: {} }
  const mod: { default: Config } = await import(pathToFileURL(path).href)
  return mod.default
}

export const isEnabled = (config: Config, name: RuleName): boolean => config.rules[name] !== false
