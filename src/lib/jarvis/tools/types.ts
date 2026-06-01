export interface JarvisTool {
  name: string
  definition: object
  handle: (args: unknown) => Promise<string>
}
