'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Save, Image as ImageIcon } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  letterhead_url: string | null;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
}

export function OrgSettings() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchOrg();
  }, []);

  async function fetchOrg() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (userData?.organization_id) {
        const { data: orgData, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', userData.organization_id)
          .single();

        if (error) throw error;
        setOrg(orgData);
      }
    } catch (error) {
      console.error('Error fetching org:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!org) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('organizations')
        .update({
          margin_top: org.margin_top,
          margin_bottom: org.margin_bottom,
          margin_left: org.margin_left,
          margin_right: org.margin_right,
        })
        .eq('id', org.id);

      if (error) throw error;
      alert('Einstellungen gespeichert!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !org) return;

    // Limit file size to 2MB for letterheads (Admin Image Hardening)
    if (file.size > 2 * 1024 * 1024) {
      alert('Die Datei ist zu groß. Bitte wählen Sie ein Bild unter 2MB.');
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${org.id}/letterhead-${Date.now()}.${fileExt}`;
      const filePath = `letterheads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('letterheads')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('letterheads')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ letterhead_url: publicUrl })
        .eq('id', org.id);

      if (updateError) throw updateError;

      setOrg((prev) => prev ? { ...prev, letterhead_url: publicUrl } : null);
      alert('Briefkopf hochgeladen!');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Fehler beim Hochladen.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!org) return <div>Keine Organisation gefunden.</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Briefkopf & Dokumenten-Layout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Letterhead Upload */}
          <div className="space-y-4">
            <Label>Benutzerdefinierter Briefkopf (Logo/Header Bild)</Label>
            <div className="flex items-start gap-6">
              <div className="flex-1 border-2 border-dashed rounded-lg p-4 bg-slate-50 flex flex-col items-center justify-center min-h-[120px]">
                {org.letterhead_url ? (
                  <div className="relative w-full group">
                    {org.letterhead_url.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex flex-col items-center justify-center py-4">
                        <FileText className="w-12 h-12 text-blue-500" />
                        <span className="text-xs text-slate-500 mt-2">PDF Briefkopf</span>
                      </div>
                    ) : (
                      <img src={org.letterhead_url} alt="Letterhead" className="max-h-32 mx-auto object-contain" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                      <Label htmlFor="letterhead-upload" className="cursor-pointer text-white flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Ändern
                      </Label>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-sm text-slate-500">Kein Briefkopf hochgeladen</p>
                    <Label htmlFor="letterhead-upload" className="cursor-pointer text-blue-600 hover:underline text-sm">
                      Datei auswählen
                    </Label>
                  </div>
                )}
                <input
                  id="letterhead-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Lädt hoch...
                </div>
              )}
            </div>
          </div>

          <hr />

          {/* Margins */}
          <div className="space-y-4">
            <Label>Seitenabstände (in mm)</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="margin_top" className="text-xs text-slate-500">Oben</Label>
                <Input
                  id="margin_top"
                  type="number"
                  value={org.margin_top}
                  onChange={(e) => setOrg({ ...org, margin_top: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="margin_bottom" className="text-xs text-slate-500">Unten</Label>
                <Input
                  id="margin_bottom"
                  type="number"
                  value={org.margin_bottom}
                  onChange={(e) => setOrg({ ...org, margin_bottom: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="margin_left" className="text-xs text-slate-500">Links</Label>
                <Input
                  id="margin_left"
                  type="number"
                  value={org.margin_left}
                  onChange={(e) => setOrg({ ...org, margin_left: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="margin_right" className="text-xs text-slate-500">Rechts</Label>
                <Input
                  id="margin_right"
                  type="number"
                  value={org.margin_right}
                  onChange={(e) => setOrg({ ...org, margin_right: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 border-t flex justify-end p-4">
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Einstellungen speichern
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
