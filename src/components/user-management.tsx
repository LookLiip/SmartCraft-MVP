'use client';

import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  UserPlus, 
  Trash2, 
  UserCheck, 
  UserX, 
  Loader2, 
  Search, 
  Mail, 
  Languages, 
  ShieldCheck,
  MoreHorizontal,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { inviteUserAction, toggleUserStatusAction } from '@/lib/actions/user-management';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'worker' | 'admin' | 'owner';
  native_language: string;
  deleted_at: string | null;
  created_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isSubmitting, setIsAddSubmitting] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  // New User Form State
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    role: 'worker' as const,
    native_language: 'de'
  });

  const supabase = createClient();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (userData?.organization_id) {
        setOrgId(userData.organization_id);
        const { data: usersData, error } = await supabase
          .from('users')
          .select('*')
          .eq('organization_id', userData.organization_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setUsers(usersData || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    setIsAddSubmitting(true);
    try {
      const result = await inviteUserAction({
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
        native_language: newUser.native_language
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      setIsAddUserOpen(false);
      setNewUser({
        email: '',
        full_name: '',
        role: 'worker',
        native_language: 'de'
      });
      fetchUsers();
    } catch (error) {
      console.error('Error adding user:', error);
    } finally {
      setIsAddSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: User) => {
    const isDeactivating = !user.deleted_at;
    
    try {
      const result = await toggleUserStatusAction(user.id, isDeactivating);
      if (result.error) {
        alert(result.error);
        return;
      }
      
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Mitarbeiter suchen..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <UserPlus className="w-4 h-4 mr-2" />
              Mitarbeiter einladen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuen Mitarbeiter hinzufügen</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vollständiger Name</Label>
                <Input 
                  id="name" 
                  required 
                  placeholder="z.B. Max Mustermann"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail Adresse</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  placeholder="max@beispiel.de"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rolle</Label>
                  <select 
                    id="role"
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  >
                    <option value="worker">Worker</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Muttersprache</Label>
                  <select 
                    id="language"
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    value={newUser.native_language}
                    onChange={(e) => setNewUser({ ...newUser, native_language: e.target.value })}
                  >
                    <option value="de">Deutsch</option>
                    <option value="tr">Türkisch</option>
                    <option value="pl">Polnisch</option>
                    <option value="en">Englisch</option>
                    <option value="it">Italienisch</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>Abbrechen</Button>
                <Button type="submit" className="bg-blue-600" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Einladen
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name / E-Mail</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rolle</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sprache</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                    Mitarbeiter werden geladen...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Keine Mitarbeiter gefunden.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className={`${user.deleted_at ? 'opacity-50 grayscale bg-slate-50/50' : 'hover:bg-slate-50/50'} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{user.full_name}</span>
                        <span className="text-xs text-slate-500 flex items-center mt-0.5">
                          <Mail className="w-3 h-3 mr-1" />
                          {user.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-slate-600 capitalize">
                        <ShieldCheck className="w-4 h-4 mr-2 text-slate-400" />
                        {user.role}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-slate-600 uppercase">
                        <Languages className="w-4 h-4 mr-2 text-slate-400" />
                        {user.native_language}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.deleted_at ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <UserX className="w-3 h-3 mr-1" /> Inaktiv
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <UserCheck className="w-3 h-3 mr-1" /> Aktiv
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={user.deleted_at ? "text-green-600" : "text-red-600"}
                        onClick={() => toggleUserStatus(user)}
                      >
                        {user.deleted_at ? "Reaktivieren" : "Deaktivieren"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
