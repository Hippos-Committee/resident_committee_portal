import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import {
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import type { SheetData as BaseSheetData } from "~/lib/google.server";

const CHART_COLORS = [
    "#6366f1", // indigo
    "#f59e0b", // amber
    "#10b981", // emerald
    "#ef4444", // red
    "#8b5cf6", // violet
    "#06b6d4", // cyan
    "#f97316", // orange
    "#84cc16", // lime
    "#ec4899", // pink
    "#14b8a6", // teal
];

interface SheetData extends BaseSheetData {
    allRows?: Record<string, string>[];
}

interface AnalyticsChartProps {
    sheetData: SheetData | null;
    selectedColumnIndex?: number;
}

export function AnalyticsChart({
    sheetData,
    selectedColumnIndex = 0,
}: AnalyticsChartProps) {
    const [chartType, setChartType] = useState<"pie" | "bar">("pie");
    const [aiData, setAiData] = useState<Array<{ name: string; value: number }> | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Reset AI data when column changes
    useEffect(() => {
        setAiData(null);
    }, [selectedColumnIndex, sheetData?.headers]);

    // Generate chart data from selected column
    const chartData = useMemo(() => {
        if (aiData) return aiData;
        if (!sheetData?.allRows || selectedColumnIndex >= sheetData.headers.length)
            return [];

        const header = sheetData.headers[selectedColumnIndex];
        const counts: Record<string, number> = {};

        for (const row of sheetData.allRows) {
            const value = row[header] || "(empty)";
            counts[value] = (counts[value] || 0) + 1;
        }

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10
    }, [sheetData, selectedColumnIndex, aiData]);

    const handleAnalyze = async () => {
        if (!sheetData?.allRows) return;
        setIsAnalyzing(true);

        try {
            const header = sheetData.headers[selectedColumnIndex];
            const texts = sheetData.allRows
                .map((r) => r[header])
                .filter((v) => v && v.trim().length > 0 && v !== "(empty)");

            const formData = new FormData();
            formData.append("texts", JSON.stringify(texts));

            const response = await fetch("/api/analytics/analyze", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();
            if (result.data) {
                setAiData(result.data);
                setChartType("bar"); // Bar chart is better for word counts
                toast.success("Analysis complete");
            } else if (result.error) {
                console.error(result.error);
                toast.error(result.error);
            }
        } catch (error) {
            console.error("Analysis failed", error);
            toast.error("Analysis failed. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (!sheetData) return null;

    const selectedHeader = sheetData.headers[selectedColumnIndex];
    const isTextColumn = chartData.length > 5; // Heuristic for text column

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                <div className="flex flex-col">
                    <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        Chart
                        {aiData && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                AI Analysis
                            </span>
                        )}
                    </h3>
                    <p className="text-sm text-gray-500">
                        Analysis for:{" "}
                        <span className="font-medium text-indigo-600">
                            Q{selectedColumnIndex + 1}
                        </span>{" "}
                        - {selectedHeader}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isTextColumn && (
                        <Button
                            variant={aiData ? "outline" : "default"}
                            size="sm"
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="h-8 text-xs"
                        >
                            {isAnalyzing ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-[14px] mr-2">
                                        refresh
                                    </span>
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[14px] mr-2">
                                        {aiData ? "refresh" : "auto_awesome"}
                                    </span>
                                    {aiData ? "Re-analyze" : "Analyze with AI"}
                                </>
                            )}
                        </Button>
                    )}
                    <Select
                        value={chartType}
                        onValueChange={(v) => setChartType(v as "pie" | "bar")}
                    >
                        <SelectTrigger className="w-24">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pie">Pie</SelectItem>
                            <SelectItem value="bar">Bar</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {chartData.length > 0 ? (
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === "pie" ? (
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={2}
                                >
                                    {chartData.map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                                            strokeWidth={0}
                                        />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{
                                        borderRadius: "8px",
                                        border: "none",
                                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                    }}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    wrapperStyle={{
                                        fontSize: "12px",
                                        maxWidth: "40%",
                                        maxHeight: "240px",
                                        overflowY: "auto",
                                        paddingRight: "10px",
                                    }}
                                />
                            </PieChart>
                        ) : (
                            <BarChart data={chartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    tick={{ fontSize: 11 }}
                                    interval={0}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                                    contentStyle={{
                                        borderRadius: "8px",
                                        border: "none",
                                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                    }}
                                />
                                <Bar
                                    dataKey="value"
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                >
                                    {chartData.map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-32 flex items-center justify-center text-gray-400">
                    No data to visualize
                </div>
            )}
        </div>
    );
}
