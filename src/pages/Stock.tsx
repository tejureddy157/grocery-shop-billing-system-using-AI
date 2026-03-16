import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Package, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function Stock() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"manual_add" | "manual_remove">("manual_add");

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("stock_quantity", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["stock_history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_history").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const handleAdjust = async () => {
    if (!user || !selectedProduct || !adjustQty) return;
    const qty = Number(adjustQty);
    if (qty <= 0) return;

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const prevStock = Number(product.stock_quantity);
    const newStock = adjustType === "manual_add" ? prevStock + qty : Math.max(0, prevStock - qty);

    try {
      await supabase.from("products").update({ stock_quantity: newStock }).eq("id", selectedProduct);
      await supabase.from("stock_history").insert({
        product_id: selectedProduct,
        user_id: user.id,
        change_type: adjustType,
        quantity_change: adjustType === "manual_add" ? qty : -qty,
        previous_stock: prevStock,
        new_stock: newStock,
        note: `Manual ${adjustType === "manual_add" ? "addition" : "removal"}`,
      });

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock_history"] });
      toast({ title: "Stock updated!" });
      setAdjustOpen(false);
      setAdjustQty("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const lowStock = products.filter((p) => Number(p.stock_quantity) < 10);
  const productNameMap = new Map(products.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Stock Management</h1>
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogTrigger asChild>
            <Button><Package className="mr-1 h-4 w-4" /> Adjust Stock</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Adjust Stock</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.stock_quantity} {p.unit})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={adjustType} onValueChange={(v: any) => setAdjustType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual_add">Add Stock</SelectItem>
                    <SelectItem value="manual_remove">Remove Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} min="0.5" step="0.5" />
              </div>
              <Button onClick={handleAdjust} className="w-full">
                {adjustType === "manual_add" ? <Plus className="mr-1 h-4 w-4" /> : <Minus className="mr-1 h-4 w-4" />}
                {adjustType === "manual_add" ? "Add" : "Remove"} Stock
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Low Stock Warning */}
      {lowStock.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-warning">
              <AlertTriangle className="h-4 w-4" /> Low Stock Warning ({lowStock.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((p) => (
                <span key={p.id} className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-medium">
                  {p.name}: {p.stock_quantity} {p.unit}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Products Stock */}
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Current Stock</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell className="font-display font-bold">{p.stock_quantity}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell>
                    {Number(p.stock_quantity) < 5 ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Critical</span>
                    ) : Number(p.stock_quantity) < 10 ? (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Low</span>
                    ) : (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">In Stock</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stock History */}
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Recent Stock Changes</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>New Stock</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No stock changes yet</TableCell></TableRow>
              ) : (
                history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{productNameMap.get(h.product_id) ?? "Unknown"}</TableCell>
                    <TableCell className="capitalize">{h.change_type.replace("_", " ")}</TableCell>
                    <TableCell className={Number(h.quantity_change) > 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                      {Number(h.quantity_change) > 0 ? "+" : ""}{h.quantity_change}
                    </TableCell>
                    <TableCell>{h.new_stock}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(h.created_at).toLocaleString("en-IN")}</TableCell>
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
