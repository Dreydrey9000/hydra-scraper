import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getVenvPython } from '../config.js';
import type { Engine, ScrapeOptions, ScrapeResult, Attempt, Capability } from '../types.js';

const execFileAsync = promisify(execFile);

/**
 * MarkItDown — Microsoft's universal file-to-markdown converter.
 * Runs a Python subprocess that uses markitdown to convert URLs (PDF, DOCX, HTML, images) to markdown.
 * Requires markitdown to be installed in the project venv or system Python.
 */
export function createMarkItDownEngine(): Engine {
  return {
    name: 'markitdown',
    tier: 1,
    capabilities: ['pdf', 'html'] as Capability[],

    async isAvailable(): Promise<boolean> {
      const python = getVenvPython();
      try {
        await execFileAsync(python, ['-c', 'import markitdown'], {
          timeout: 5_000,
        });
        return true;
      } catch {
        return false;
      }
    },

    async scrape(url: string, opts: ScrapeOptions): Promise<ScrapeResult | null> {
      const start = Date.now();
      const attempts: Attempt[] = [];
      const timeout = opts.timeout ?? 30_000;
      const python = getVenvPython();

      const script = [
        'from markitdown import MarkItDown',
        'md = MarkItDown()',
        `result = md.convert_url(${JSON.stringify(url)})`,
        'print(result.text_content)',
      ].join('; ');

      try {
        const { stdout, stderr } = await execFileAsync(python, ['-c', script], {
          timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB — PDFs can be large
        });

        if (stderr && !stdout.trim()) {
          attempts.push({
            engine: 'markitdown',
            success: false,
            error: `Python stderr: ${stderr.slice(0, 500)}`,
            durationMs: Date.now() - start,
          });
          return null;
        }

        const markdown = stdout.trim();

        if (!markdown) {
          attempts.push({
            engine: 'markitdown',
            success: false,
            error: 'MarkItDown returned empty content',
            durationMs: Date.now() - start,
          });
          return null;
        }

        attempts.push({
          engine: 'markitdown',
          success: true,
          durationMs: Date.now() - start,
          contentLength: markdown.length,
        });

        return {
          url,
          markdown,
          engine: 'markitdown',
          attempts,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push({
          engine: 'markitdown',
          success: false,
          error: message,
          durationMs: Date.now() - start,
        });
        return null;
      }
    },
  };
}
