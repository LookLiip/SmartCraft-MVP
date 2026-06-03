import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl
  const hostname = request.headers.get('host') || ''
  
  // Extract subdomain (e.g., tenant1.smartcraft.app -> tenant1)
  const parts = hostname.split('.')
  let subdomain = ''
  
  // If we have more than 2 parts, the first one is likely the subdomain
  // This works for tenant.smartcraft.app and localhost with port
  if (parts.length > 2 && !parts[0].startsWith('localhost')) {
    subdomain = parts[0]
  }

  // Skip subdomain logic for common reserved words
  if (['www', 'app', 'api', 'admin'].includes(subdomain)) {
    subdomain = ''
  }

  // Update session and get response
  const response = await updateSession(request)

  // Pass subdomain to downstream via header if detected
  if (subdomain) {
    response.headers.set('x-tenant-slug', subdomain)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
