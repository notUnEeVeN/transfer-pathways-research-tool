import LoadingLogo from './LoadingLogo'

// The app's default full-page / route loader: a centered skeleton of the brand
// mark — no spinner, no "loading" text. Used by route Suspense fallbacks and
// page guards (RequireAuth, RequireCollege, etc.).
export default function LoadingPage() {
  return (
    <div className='min-h-screen grid place-items-center'>
      <LoadingLogo size={64} />
    </div>
  )
}
