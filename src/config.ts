import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { HydraConfig } from './types.js';

/**
 * Loads config from ~/.hydra.json if it exists, then fills gaps with env vars.
 * Always returns a valid HydraConfig — worst case it's all defaults.
 */
export function loadConfig(): HydraConfig {
  const configPath = join(homedir(), '.hydra.json');

  let fileConfig: Partial<HydraConfig> = {};

  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw) as Partial<HydraConfig>;
    } catch {
      // Malformed JSON — silently fall through to defaults
    }
  }

  // Env vars fill in anything the file didn't provide
  const config: HydraConfig = {
    firecrawlApiKey: fileConfig.firecrawlApiKey ?? process.env.FIRECRAWL_API_KEY,
    tavilyApiKey: fileConfig.tavilyApiKey ?? process.env.TAVILY_API_KEY,
    exaApiKey: fileConfig.exaApiKey ?? process.env.EXA_API_KEY,
    browserbaseApiKey: fileConfig.browserbaseApiKey ?? process.env.BROWSERBASE_API_KEY,
    pythonPath: fileConfig.pythonPath,
    venvPath: fileConfig.venvPath,
    defaultTimeout: fileConfig.defaultTimeout ?? 15_000,
    preferredTier: fileConfig.preferredTier,
  };

  return config;
}

/**
 * Returns the path to python inside the project's .venv.
 * Falls back to system 'python3' if the venv doesn't exist.
 *
 * Why a venv? Python engines (crawl4ai, scrapling) need isolated deps.
 * This keeps them from polluting the global install.
 */
export function getVenvPython(): string {
  // Walk up from this file's location to find the project root
  // In compiled form this lives at dist/config.js, so project root is one up
  const projectRoot = join(import.meta.dirname, '..');
  const venvPython = join(projectRoot, '.venv', 'bin', 'python3');

  if (existsSync(venvPython)) {
    return venvPython;
  }

  return 'python3';
}
