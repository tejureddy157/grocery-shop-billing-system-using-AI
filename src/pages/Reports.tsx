import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, LineChart, Line } from "recharts";
import { IndianRupee, Receipt, TrendingUp } from "lucide-react";

export default function Reports() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [dailyData, setDailyData] = useState<{ totalSales: number; totalBills: number; items: any[] }>({
    totalSales: 0,
    totalBills: 0,
    items: [],
  });
  const [weeklySales, setWeeklySales] = useState<{ date: string; amount: number }[]>([]);

  useEffect(() => {
    if (!user) return;

    async function fetchReport() {
      // Daily sales
      const { data: sales } = await supabase
        .from("sales")
        .select("id, total_amount, bill_number, created_at")
        .gte("created_at", selectedDate + "T00:00:00")
        .lte("created_at", selectedDate + "T23:59:59")
        .order("created_at", { ascending: false });

      const totalSales = sales?.reduce((s, sale) => s + Number(sale.total_amount), 0) ?? 0;
      const totalBills = sales?.length ?? 0;

      // Sale items for the day
      let items: any[] = [];
      if (sales && sales.length > 0) {
        const saleIds = sales.map((s) => s.id);
        const { data: saleItems } = await supabase
          .from("sale_items")
          .select("product_name, quantity, unit_price, total_price")
          .in("sale_id", saleIds);

        if (saleItems) {
          const productMap = new Map<string, { quantity: number; total: number; price: number }>();
          saleItems.forEach((item) => {
            const existing = productMap.get(item.product_name) ?? { quantity: 0, total: 0, price: Number(item.unit_price) };
            productMap.set(item.product_name, {
              quantity: existing.quantity + Number(item.quantity),
              total: existing.total + Number(item.total_price),
              price: existing.price,
            });
          });
          items = Array.from(productMap.entries()).map(([name, data]) => ({
            name,
            quantity: data.quantity,
            total: data.total,
            price: data.price,
          }));
        }
      }

      setDailyData({ totalSales, totalBills, items });

      // Weekly trend
      const weekData: { date: string; amount: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const { data: daySales } = await supabase
          .from("sales")
          .select("total_amount")
          .gte("created_at", dateStr + "T00:00:00")
          .lte("created_at", dateStr + "T23:59:59");

        weekData.push({
          date: d.toLocaleDateString("en-IN", { weekday: "short" }),
          amount: daySales?.reduce((s, sale) => s + Number(sale.total_amount), 0) ?? 0,
        });
      }
      setWeeklySales(weekData);
    }

    fetchReport();
  }, [user, selectedDate]);

  const chartConfig = {
    amount: { label: "Sales (₹)", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Sales Reports</h1>
        <div className="flex items-center gap-2">
          <Label>Date:</Label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-primary/10 p-3 text-primary"><IndianRupee className="h-5 w-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="font-display text-xl font-bold">₹{dailyData.totalSales.toLocaleString("en-IN")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-secondary/10 p-3 text-secondary"><Receipt className="h-5 w-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="font-display text-xl font-bold">{dailyData.totalBills}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-accent p-3 text-accent-foreground"><TrendingUp className="h-5 w-5" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Items Sold</p>
              <p className="font-display text-xl font-bold">{dailyData.items.reduce((s, i) => s + i.quantity, 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend */}
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">7-Day Sales Trend</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <LineChart data={weeklySales}>
              <XAxis dataKey="date" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Products Sold</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyData.items.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No sales on this date</TableCell></TableRow>
              ) : (
                dailyData.items.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>₹{item.price.toFixed(2)}</TableCell>
                    <TableCell className="font-bold">₹{item.total.toFixed(2)}</TableCell>
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
