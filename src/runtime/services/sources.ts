import * as Fs from 'fs'
import * as Path from 'path'
import glob from 'glob'
import { createStorage } from 'unstorage'
import githubDriver from 'unstorage/drivers/github'
import { Blob } from 'buffer'

type GithubOptions = {
  repo: string,
  branch?: string,
  dir?: string,
  ttl?: number
}

export async function getGithubAssets (source: GithubOptions, tempPath: string, extensions: string[]): Promise<string[]> {
  // storage
  const storage = createStorage()
  storage.mount('gh', githubDriver({
    repo: source.repo,
    branch: source.branch || 'main',
    dir: source.dir || '/',
    ttl: source.ttl || 600
  }))

  // test asset against registered extensions
  const rx = new RegExp(`\.${extensions.join('|')}$`)

  // get assets
  const keys = await storage.getKeys()
  const assetKeys = keys.filter(key => rx.test(key))
  const assetItems = await Promise.all(assetKeys.map(async key => {
    const data = await storage.getItem(key)
    return { key, data }
  }))

  // copy assets to temp path
  const paths: string[] = []
  for (const { key, data } of assetItems) {
    if (data) {
      // variables
      const path = key.replaceAll(':', '/')
      const absPath = Path.join(tempPath, path)
      const absFolder = Path.dirname(absPath)

      // save file
      const buffer = data.constructor.name === 'Blob'
        ? Buffer.from(await (data as Blob).arrayBuffer())
        : typeof data === 'object'
          ? JSON.stringify(data, null, '  ')
          : String(data)
      Fs.mkdirSync(absFolder, { recursive: true })
      Fs.writeFileSync(absPath, buffer)

      // update paths
      paths.push(absPath)
    }
  }

  // return
  return paths
}

export function getFsAssets (path: string, extensions: string[]) {
  const pattern = `${path}/**/*.{${extensions.join(',')}}`
  return glob.globSync(pattern) || []
}