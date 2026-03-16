import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Receipt, TrendingUp, AlertTriangle } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CHART_COLORS = [
  "hsl(142, 55%, 35%)",
  "hsl(35, 80%, 55%)",
  "hsl(200, 60%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(270, 50%, 50%)",
  "hsl(180, 50%, 45%)",
];

export default function Dashboard() {
  const { user } = useAuth();
  const [todaySales, setTodaySales] = useState(0);
  const [todayBills, setTodayBills] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number }[]>([]);
  const [categorySales, setCategorySales] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];

    async function fetchDashboard() {
      // Today's sales
      const { data: salesData } = await supabase
        .from("sales")
        .select("total_amount")
        .gte("created_at", today + "T00:00:00")
        .lte("created_at", today + "T23:59:59");

      if (salesData) {
        setTodaySales(salesData.reduce((sum, s) => sum + Number(s.total_amount), 0));
        setTodayBills(salesData.length);
      }

      // Low stock
      const { data: lowStock } = await supabase
        .from("products")
        .select("id")
        .lt("stock_quantity", 10);
      setLowStockCount(lowStock?.length ?? 0);

      // Top selling items today
      const { data: todaySaleIds } = await supabase
        .from("sales")
        .select("id")
        .gte("created_at", today + "T00:00:00")
        .lte("created_at", today + "T23:59:59");

      if (todaySaleIds && todaySaleIds.length > 0) {
        const saleIds = todaySaleIds.map((s) => s.id);
        const { data: items } = await supabase
          .from("sale_items")
          .select("product_name, quantity")
          .in("sale_id", saleIds);

        if (items) {
          const productMap = new Map<string, number>();
          items.forEach((item) => {
            productMap.set(item.product_name, (productMap.get(item.product_name) ?? 0) + Number(item.quantity));
          });
          const sorted = Array.from(productMap.entries())
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
          setTopProducts(sorted);
        }
      }

      // Category breakdown
      const { data: products } = await supabase.from("products").select("category, stock_quantity");
      if (products) {
        const catMap = new Map<string, number>();
        products.forEach((p) => {
          catMap.set(p.category, (catMap.get(p.category) ?? 0) + Number(p.stock_quantity));
        });
        setCategorySales(Array.from(catMap.entries()).map(([name, value]) => ({ name, value })));
      }
    }

    fetchDashboard();
  }, [user]);

  const stats = [
    { label: "Today's Sales", value: `₹${todaySales.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-success" },
    { label: "Bills Generated", value: todayBills, icon: Receipt, color: "text-primary" },
    { label: "Top Item", value: topProducts[0]?.name ?? "—", icon: TrendingUp, color: "text-secondary" },
    { label: "Low Stock Items", value: lowStockCount, icon: AlertTriangle, color: "text-destructive" },
  ];

  const chartConfig = {
    quantity: { label: "Qty Sold", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to Brunda Traders</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={cn("rounded-xl bg-muted p-3", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="font-display text-xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Top Selling Items Today</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px]">
                <BarChart data={topProducts}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-10 text-center text-muted-foreground">No sales yet today</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Stock by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categorySales.length > 0 ? (
              <ChartContainer config={{}} className="h-[250px]">
                <PieChart>
                  <Pie data={categorySales} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {categorySales.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="py-10 text-center text-muted-foreground">No products added yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
