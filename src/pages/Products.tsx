import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const CATEGORIES = ["Rice", "Dal", "Cooking Oil", "Spices", "Flour", "Sugar", "Other"] as const;
const UNITS = ["kg", "litre", "packet", "piece", "gram"] as const;

const productSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  category: z.enum(CATEGORIES),
  price: z.number().min(0, "Price must be positive"),
  stock_quantity: z.number().min(0),
  unit: z.enum(UNITS),
});

export default function Products() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", category: "Rice" as string, price: "", stock_quantity: "", unit: "kg" as string });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setForm({ name: "", category: "Rice", price: "", stock_quantity: "", unit: "kg" });
    setEditingId(null);
  };

  const handleEdit = (p: typeof products[0]) => {
    setForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      stock_quantity: String(p.stock_quantity),
      unit: p.unit,
    });
    setEditingId(p.id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const parsed = productSchema.safeParse({
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock_quantity: Number(form.stock_quantity),
      unit: form.unit,
    });

    if (!parsed.success) {
      toast({ title: "Validation Error", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase.from("products").update(parsed.data).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Product updated!" });
      } else {
        const { error } = await supabase.from("products").insert([{
          name: parsed.data.name,
          category: parsed.data.category,
          price: parsed.data.price,
          stock_quantity: parsed.data.stock_quantity,
          unit: parsed.data.unit,
          user_id: user.id,
        }]);
        if (error) throw error;
        toast({ title: "Product added!" });
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product deleted" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Products</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> Add Product</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} placeholder="e.g. Sona Masoori Rice" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price (₹)</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} min="0" step="0.5" />
                </div>
                <div className="space-y-2">
                  <Label>Stock Quantity</Label>
                  <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} min="0" step="0.5" />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editingId ? "Update Product" : "Add Product"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No products yet. Add your first product!</TableCell></TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{p.category}</span>
                    </TableCell>
                    <TableCell>₹{Number(p.price).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={Number(p.stock_quantity) < 10 ? "font-medium text-destructive" : ""}>
                        {p.stock_quantity}
                      </span>
                    </TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
