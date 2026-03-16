import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Minus, Trash2, Printer, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

interface CartItem {
  product: Tables<"products">;
  quantity: number;
}

export default function Billing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [lastBill, setLastBill] = useState<{ billNumber: number; total: number; items: CartItem[] } | null>(null);
  const billRef = useRef<HTMLDivElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Tables<"products">) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const total = cart.reduce((sum, i) => sum + i.quantity * Number(i.product.price), 0);

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;
    setProcessing(true);

    try {
      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({ user_id: user.id, total_amount: total })
        .select()
        .single();
      if (saleError) throw saleError;

      // Create sale items
      const items = cart.map((i) => ({
        sale_id: sale.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: Number(i.product.price),
        total_price: i.quantity * Number(i.product.price),
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(items);
      if (itemsError) throw itemsError;

      // Update stock for each product
      for (const item of cart) {
        const newStock = Number(item.product.stock_quantity) - item.quantity;
        await supabase.from("products").update({ stock_quantity: Math.max(0, newStock) }).eq("id", item.product.id);

        await supabase.from("stock_history").insert({
          product_id: item.product.id,
          user_id: user.id,
          change_type: "sale",
          quantity_change: -item.quantity,
          previous_stock: Number(item.product.stock_quantity),
          new_stock: Math.max(0, newStock),
          note: `Bill #${sale.bill_number}`,
        });
      }

      setLastBill({ billNumber: sale.bill_number, total, items: [...cart] });
      setCart([]);
      toast({ title: "Sale Complete!", description: `Bill #${sale.bill_number} — ₹${total.toLocaleString("en-IN")}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    if (billRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Bill</title>
          <style>body{font-family:monospace;padding:20px;max-width:300px;margin:0 auto}
          table{width:100%;border-collapse:collapse}td,th{padding:4px 2px;text-align:left;font-size:12px}
          .right{text-align:right}.center{text-align:center}hr{border:1px dashed #000}
          h2,h3{margin:4px 0}</style></head>
          <body>${billRef.current.innerHTML}</body></html>`);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Billing</h1>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Product Search */}
        <div className="space-y-3 lg:col-span-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, 12).map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category} · {p.stock_quantity} {p.unit}</p>
                </div>
                <span className="font-display text-sm font-bold text-primary">₹{Number(p.price).toFixed(0)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <ShoppingCart className="h-5 w-5" /> Cart ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Add products to start billing</p>
            ) : (
              <>
                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between rounded-md border p-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">₹{Number(item.product.price)} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(item.product.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(item.product.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="ml-2 w-16 text-right text-sm font-bold">₹{(item.quantity * Number(item.product.price)).toFixed(0)}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="font-display">₹{total.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <Button onClick={handleCheckout} disabled={processing} className="w-full" size="lg">
                  {processing ? "Processing..." : `Complete Sale — ₹${total.toLocaleString("en-IN")}`}
                </Button>
              </>
            )}

            {/* Last Bill */}
            {lastBill && (
              <div className="mt-4 space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Bill #{lastBill.billNumber}</span>
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="mr-1 h-3 w-3" /> Print
                  </Button>
                </div>
                <div ref={billRef} className="hidden">
                  <div className="center">
                    <h2>Brunda Traders</h2>
                    <p>Retail Grocery Shop</p>
                    <hr />
                    <p>Bill #{lastBill.billNumber}</p>
                    <p>{new Date().toLocaleString("en-IN")}</p>
                    <hr />
                  </div>
                  <table>
                    <thead>
                      <tr><th>Item</th><th className="right">Qty</th><th className="right">Price</th><th className="right">Total</th></tr>
                    </thead>
                    <tbody>
                      {lastBill.items.map((i) => (
                        <tr key={i.product.id}>
                          <td>{i.product.name}</td>
                          <td className="right">{i.quantity}</td>
                          <td className="right">₹{Number(i.product.price)}</td>
                          <td className="right">₹{(i.quantity * Number(i.product.price)).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <hr />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>Total</strong><strong>₹{lastBill.total.toLocaleString("en-IN")}</strong>
                  </div>
                  <hr />
                  <p className="center">Thank you for shopping!</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
