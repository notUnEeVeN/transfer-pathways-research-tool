export function shouldShowShowcase(env = {}) {
  return !env.PROD || env.VITE_SHOWCASE_ENABLED === 'true'
}

// Local development keeps the prototype one click away. Production builds
// hide it unless the deployment explicitly opts in.
export const SHOWCASE_ENABLED = shouldShowShowcase(import.meta.env)
