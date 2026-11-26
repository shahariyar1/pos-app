"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage, revalidate } from "@/lib/fetcher";

export function CompatibleModelsEditor({ productId, initialModels }: { productId: string; initialModels: string[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialModels.join("\n"));
  const [saving, setSaving] = useState(false);

  function showEditor() {
    setValue(initialModels.join("\n"));
    setOpen(true);
  }

  async function save() {
    const models = [...new Set(value.split(/[=\n,]+/).map((item) => item.trim()).filter(Boolean).map((item) => item.toLowerCase()))]
      .map((model) => value.split(/[=\n,]+/).map((item) => item.trim()).find((item) => item.toLowerCase() === model)!);
    setSaving(true);
    try {
      await api(`/api/products/${productId}`, { method: "PATCH", body: JSON.stringify({ compatibleModels: models }) });
      toast.success("Compatible models updated");
      revalidate("/api/products");
      setOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return <>
    <Button type="button" variant="outline" size="sm" onClick={showEditor}>
      <Pencil className="mr-1 size-4" aria-hidden /> Edit
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit compatible models</DialogTitle>
          <DialogDescription>Add new models, remove old ones, or replace the full list. Put one model per line.</DialogDescription>
        </DialogHeader>
        <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={9}
          aria-label="Compatible models" placeholder={"Honor 8C\nHonor 8C Play\nBKK-L21"}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
