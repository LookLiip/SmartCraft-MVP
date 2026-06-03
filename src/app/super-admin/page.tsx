'use server'

import React from 'react'
import { getTenantsAction, createTenantAction } from '@/lib/actions/super-admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function SuperAdminPage() {
  const { tenants, error } = await getTenantsAction()
  
  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Existing Tenants (Organizations)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Name</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Slug / Subdomain</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tenants?.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{tenant.name}</td>
                      <td className="px-4 py-3 text-blue-600">
                        <code>{tenant.slug || 'no-slug'}</code>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {(!tenants || tenants.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        No tenants found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create New Tenant</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={async (formData) => {
              'use server'
              const name = formData.get('name') as string
              const slug = formData.get('slug') as string
              const adminEmail = formData.get('adminEmail') as string
              const adminName = formData.get('adminName') as string
              
              await createTenantAction({ name, slug, adminEmail, adminName })
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input name="name" id="name" required placeholder="e.g. Acme Construction" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Subdomain Slug</Label>
                <Input name="slug" id="slug" required placeholder="e.g. acme" />
                <p className="text-[10px] text-slate-500 italic">This will be acme.smartcraft.app</p>
              </div>
              <hr className="my-4" />
              <div className="space-y-2">
                <Label htmlFor="adminName">Admin Full Name</Label>
                <Input name="adminName" id="adminName" required placeholder="e.g. John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin Email Address</Label>
                <Input name="adminEmail" id="adminEmail" type="email" required placeholder="john@acme.com" />
              </div>
              <Button type="submit" className="w-full bg-blue-600">Create Tenant & Invite Admin</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
