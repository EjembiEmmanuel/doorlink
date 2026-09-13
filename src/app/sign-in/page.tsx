import type { Metadata } from 'next'
import Link from 'next/link'
import { SignInForm } from '@/components/auth/SignInForm'
import { NotConnected } from '@/components/ui/NotConnected'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default function SignInPage() {
  const devModeAvailable = process.env.NODE_ENV !== 'production'

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold text-graphite">Sign in</h1>
      <p className="mt-2 text-sm text-graphite-soft">
        DoorLink doesn&apos;t have a real authentication provider connected yet. Sign-in here uses a
        development-only session, not a password.
      </p>

      <div className="mt-8">
        {devModeAvailable ? (
          <SignInForm />
        ) : (
          <NotConnected feature="Sign-in" reason="No authentication provider is connected in production yet." />
        )}
      </div>

      <p className="mt-8 text-sm text-zinc-deep">
        No account?{' '}
        <Link href="/register" className="font-medium text-signal hover:text-signal-hover">
          Register
        </Link>
      </p>
    </div>
  )
}
