"use client"

import { useRouter } from "next/navigation"
import { LayoutDashboard, LogOut, ShieldCheck } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { logoutAction } from "@/lib/actions/auth"

interface UserNavProps {
  email?: string | null
  name?: string | null
  role?: 'worker' | 'admin' | 'owner' | null
  isSuperAdmin?: boolean
}

export function UserNav({ email, name, role, isSuperAdmin }: UserNavProps) {
  const router = useRouter()
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
    : email?.substring(0, 2).toUpperCase() || "U"

  const showAdminPanel = role === 'admin' || role === 'owner'
  const showSuperAdmin = isSuperAdmin === true

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-xs border border-blue-200">
            {initials}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name || "Benutzer"}</p>
            <p className="text-xs leading-none text-slate-500">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showAdminPanel && (
          <DropdownMenuItem
            onClick={() => router.push('/admin')}
            className="cursor-pointer"
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Admin Panel</span>
          </DropdownMenuItem>
        )}
        {showSuperAdmin && (
          <DropdownMenuItem
            onClick={() => router.push('/super-admin')}
            className="cursor-pointer"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            <span>Super Admin</span>
          </DropdownMenuItem>
        )}
        {(showAdminPanel || showSuperAdmin) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={() => logoutAction()} className="text-red-600 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Abmelden</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
