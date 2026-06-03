import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl
  const hostname = request.headers.get('host') || ''
  const path = url.pathname

  // 1. EXCLUSIONS: Skip subdomain logic for system routes and static files
  if (
    path.startsWith('/super-admin') ||
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/auth') ||
    path.startsWith('/favicon.ico') ||
    path.includes('.') // likely a static file extension
  ) {
    return await updateSession(request)
  }

  // 2. EXTRACT SUBDOMAIN
  const parts = hostname.split('.')
  let subdomain = ''
  
  // Handle Netlify (e.g., tenant.smartcraftmvp.netlify.app or smartcraftmvp.netlify.app)
  if (hostname.endsWith('.netlify.app')) {
    if (parts.length > 3) {
      subdomain = parts[0]
    }
  } 
  // Handle Production Domain (e.g., tenant.smartcraft.app)
  else if (hostname.endsWith('.smartcraft.app')) {
    if (parts.length > 2) {
      subdomain = parts[0]
    }
  }
  // Generic fallback for local development or custom domains
  else if (!hostname.startsWith('localhost') && parts.length > 2) {
    subdomain = parts[0]
  }

  // 3. RESERVED WORDS: Ignore common subdomains and the Netlify project name
  if (['www', 'app', 'api', 'admin', 'smartcraftmvp'].includes(subdomain.toLowerCase())) {
    subdomain = ''
  }

  // Update session
  const response = await updateSession(request)

  // 4. PASS TENANT CONTEXT: Set header if subdomain is valid
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
