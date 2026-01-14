import type { Route } from "./+types/inventory";
import { Form, Link, useNavigation, useRouteLoaderData, useSearchParams, useFetcher } from "react-router";
import { useState } from "react";
import { PageWrapper, SplitLayout, QRPanel, ActionButton, ContentArea } from "~/components/layout/page-layout";
import { getDatabase, type InventoryItem } from "~/db";
import { SITE_CONFIG } from "~/lib/config.server";
import type { loader as rootLoader } from "~/root";
import { DataTable } from "~/components/ui/data-table";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { type ColumnDef } from "@tanstack/react-table";
import { EditableCell } from "~/components/ui/editable-cell";

const PAGE_SIZE = 20;

// Column keys that can be toggled
const COLUMN_KEYS = ["name", "quantity", "location", "category", "description", "unitValue", "totalValue", "showInInfoReel"] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
    name: "Nimi / Name",
    quantity: "Määrä / Qty",
    location: "Sijainti / Location",
    category: "Kategoria / Category",
    description: "Kuvaus / Description",
    unitValue: "Kpl-arvo / Unit Value",
    totalValue: "Yht. arvo / Total Value",
    showInInfoReel: "Info Reel",
};

export function meta({ data }: Route.MetaArgs) {
    const filters = [];
    if (data?.filters?.name) filters.push(data.filters.name);
    if (data?.filters?.location) filters.push(data.filters.location);
    if (data?.filters?.category) filters.push(data.filters.category);

    const filterText = filters.length > 0 ? ` - ${filters.join(", ")}` : "";

    return [
        { title: `${data?.siteConfig?.name || "Portal"} - Tavaraluettelo${filterText} / Inventory` },
        { name: "description", content: "Toimikunnan tavaraluettelo / Tenant Committee Inventory" },
    ];
}

export async function loader({ request }: Route.LoaderArgs) {
    const db = getDatabase();
    const url = new URL(request.url);
    const nameFilter = url.searchParams.get("name") || "";
    const locationFilter = url.searchParams.get("location") || "";
    const categoryFilter = url.searchParams.get("category") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const isInfoReel = url.searchParams.get("view") === "infoReel";

    // Fetch from database
    const allItems = await db.getInventoryItems();

    // Get unique locations and categories for search dropdowns
    const uniqueLocations = [...new Set(allItems.map(item => item.location).filter(Boolean))].sort();
    const uniqueCategories = [...new Set(allItems.map(item => item.category).filter(Boolean) as string[])].sort();

    // For info reel mode: show 3 random items with showInInfoReel=true
    if (isInfoReel) {
        const reelItems = allItems.filter(item => item.showInInfoReel);
        const shuffled = reelItems.sort(() => Math.random() - 0.5);
        const items = shuffled.slice(0, 3);

        return {
            siteConfig: SITE_CONFIG,
            items,
            filters: { name: nameFilter, location: locationFilter, category: categoryFilter },
            isInfoReel: true,
            totalCount: items.length,
            currentPage: 1,
            pageSize: PAGE_SIZE,
            uniqueLocations,
            uniqueCategories,
        };
    }

    // Normal mode: apply filters and pagination
    let items = [...allItems];

    if (nameFilter) {
        const searchTerm = nameFilter.toLowerCase();
        items = items.filter(item => item.name.toLowerCase().includes(searchTerm));
    }
    if (locationFilter) {
        const searchTerm = locationFilter.toLowerCase();
        items = items.filter(item => item.location.toLowerCase() === searchTerm);
    }
    if (categoryFilter) {
        const searchTerm = categoryFilter.toLowerCase();
        items = items.filter(item => (item.category || "").toLowerCase() === searchTerm);
    }

    items = items.sort((a, b) => a.name.localeCompare(b.name, "fi"));
    const totalCount = items.length;
    const startIndex = (page - 1) * PAGE_SIZE;
    const paginatedItems = items.slice(startIndex, startIndex + PAGE_SIZE);

    return {
        siteConfig: SITE_CONFIG,
        items: paginatedItems,
        filters: { name: nameFilter, location: locationFilter, category: categoryFilter },
        isInfoReel: false,
        totalCount,
        currentPage: page,
        pageSize: PAGE_SIZE,
        uniqueLocations,
        uniqueCategories,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const db = getDatabase();
    const formData = await request.formData();
    const actionType = formData.get("_action");
    const itemId = formData.get("itemId") as string;
    const itemIds = formData.get("itemIds") as string;

    if (actionType === "delete" && itemId) {
        const purchases = await db.getPurchasesByInventoryItem(itemId);
        for (const purchase of purchases) {
            await db.deletePurchase(purchase.id);
        }
        await db.deleteInventoryItem(itemId);
    }

    if (actionType === "deleteMany" && itemIds) {
        const ids = JSON.parse(itemIds) as string[];
        for (const id of ids) {
            const purchases = await db.getPurchasesByInventoryItem(id);
            for (const purchase of purchases) {
                await db.deletePurchase(purchase.id);
            }
            await db.deleteInventoryItem(id);
        }
    }

    if (actionType === "toggleInfoReel" && itemId) {
        const item = await db.getInventoryItemById(itemId);
        if (item) {
            await db.updateInventoryItem(itemId, { showInInfoReel: !item.showInInfoReel });
        }
    }

    if (actionType === "updateField" && itemId) {
        const field = formData.get("field") as string;
        const value = formData.get("value") as string;
        if (field && ["name", "category", "description"].includes(field)) {
            await db.updateInventoryItem(itemId, { [field]: value || null });
        }
    }

    if (actionType === "report") {
        const reportItemIds = formData.get("reportItemIds") as string;
        const reportMessage = formData.get("reportMessage") as string;
        const ids = JSON.parse(reportItemIds) as string[];

        // Get item names for the report
        const itemNames: string[] = [];
        for (const id of ids) {
            const item = await db.getInventoryItemById(id);
            if (item) itemNames.push(item.name);
        }

        // Create submission
        await db.createSubmission({
            type: "questions",
            name: "Tavaraluettelo / Inventory Report",
            email: "inventory@report",
            message: `Ilmoitus tavaroista / Report for items:\n${itemNames.join(", ")}\n\nViesti / Message:\n${reportMessage}`,
        });
    }

    return { success: true };
}

export default function Inventory({ loaderData }: Route.ComponentProps) {
    const { items, filters, isInfoReel, totalCount, currentPage, pageSize, uniqueLocations, uniqueCategories } = loaderData;
    const rootData = useRouteLoaderData<typeof rootLoader>("root");
    const isStaff = rootData?.user?.role === "admin" || rootData?.user?.role === "board_member";
    const isAdmin = rootData?.user?.role === "admin";
    const navigation = useNavigation();
    const fetcher = useFetcher();
    const [searchParams, setSearchParams] = useSearchParams();
    const [reportOpen, setReportOpen] = useState(false);
    const [reportMessage, setReportMessage] = useState("");
    const [selectedForReport, setSelectedForReport] = useState<string[]>([]);
    const [localItems, setLocalItems] = useState(items);

    const isLoading = navigation.state === "loading";

    // Parse visible columns from URL (default: all visible except value and infoReel for non-staff)
    const getVisibleColumns = (): Set<ColumnKey> => {
        const colsParam = searchParams.get("cols");
        if (colsParam) {
            return new Set(colsParam.split(",").filter(c => COLUMN_KEYS.includes(c as ColumnKey)) as ColumnKey[]);
        }
        // Default visible columns
        if (isStaff) {
            return new Set(["name", "quantity", "location", "category", "description", "unitValue", "totalValue", "showInInfoReel"] as ColumnKey[]);
        }
        return new Set(["name", "quantity", "location", "category", "description"] as ColumnKey[]);
    };

    const visibleColumns = getVisibleColumns();

    const toggleColumn = (col: ColumnKey) => {
        const newVisible = new Set(visibleColumns);
        if (newVisible.has(col)) {
            newVisible.delete(col);
        } else {
            newVisible.add(col);
        }
        const params = new URLSearchParams(searchParams);
        params.set("cols", Array.from(newVisible).join(","));
        setSearchParams(params);
    };

    // Inline edit handler - optimistic update
    const handleInlineEdit = (itemId: string, field: string, value: string) => {
        // Optimistic update
        setLocalItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, [field]: value || null } : item
        ));
        // Background update
        const formData = new FormData();
        formData.set("_action", "updateField");
        formData.set("itemId", itemId);
        formData.set("field", field);
        formData.set("value", value);
        fetcher.submit(formData, { method: "POST" });
    };

    // Build columns
    const columns: ColumnDef<InventoryItem>[] = [];

    if (visibleColumns.has("name")) {
        columns.push({
            accessorKey: "name",
            header: "Nimi / Name",
            cell: ({ row }) => (
                <EditableCell
                    value={row.getValue("name")}
                    onSave={(v) => handleInlineEdit(row.original.id, "name", v)}
                    disabled={!isStaff}
                />
            ),
        });
    }

    if (visibleColumns.has("quantity")) {
        columns.push({
            accessorKey: "quantity",
            header: "Määrä / Qty",
            cell: ({ row }) => (
                <span className="text-gray-600 dark:text-gray-400">{row.getValue("quantity")} kpl</span>
            ),
        });
    }

    if (visibleColumns.has("location")) {
        columns.push({
            accessorKey: "location",
            header: "Sijainti / Location",
            cell: ({ row }) => (
                <EditableCell
                    value={row.getValue("location") || ""}
                    onSave={(v) => handleInlineEdit(row.original.id, "location", v)}
                    disabled={!isStaff}
                />
            ),
        });
    }

    if (visibleColumns.has("category")) {
        columns.push({
            accessorKey: "category",
            header: "Kategoria / Category",
            cell: ({ row }) => (
                <EditableCell
                    value={row.getValue("category") || ""}
                    onSave={(v) => handleInlineEdit(row.original.id, "category", v)}
                    disabled={!isStaff}
                />
            ),
        });
    }

    if (visibleColumns.has("description")) {
        columns.push({
            accessorKey: "description",
            header: "Kuvaus / Description",
            cell: ({ row }) => (
                <EditableCell
                    value={row.getValue("description") || ""}
                    onSave={(v) => handleInlineEdit(row.original.id, "description", v)}
                    disabled={!isStaff}
                />
            ),
        });
    }

    // Staff-only columns
    if (isStaff && visibleColumns.has("unitValue")) {
        columns.push({
            accessorKey: "value",
            header: "Kpl-arvo / Unit",
            cell: ({ row }) => {
                const value = row.getValue("value") as string | null;
                if (!value || value === "0") return <span className="text-gray-400">-</span>;
                return <span className="font-medium">{parseFloat(value).toFixed(2).replace(".", ",")} €</span>;
            },
        });
    }

    if (isStaff && visibleColumns.has("totalValue")) {
        columns.push({
            id: "totalValue",
            header: "Yht. arvo / Total",
            cell: ({ row }) => {
                const value = row.original.value as string | null;
                const qty = row.original.quantity;
                if (!value || value === "0") return <span className="text-gray-400">-</span>;
                const total = parseFloat(value) * qty;
                return <span className="font-bold text-primary">{total.toFixed(2).replace(".", ",")} €</span>;
            },
        });
    }

    if (isStaff && visibleColumns.has("showInInfoReel")) {
        columns.push({
            accessorKey: "showInInfoReel",
            header: "Info Reel",
            cell: ({ row }) => (
                <Form method="post" className="flex justify-center">
                    <input type="hidden" name="_action" value="toggleInfoReel" />
                    <input type="hidden" name="itemId" value={row.original.id} />
                    <button type="submit" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Checkbox checked={row.original.showInInfoReel} className="pointer-events-none" />
                    </button>
                </Form>
            ),
        });
    }

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", newPage.toString());
        setSearchParams(params);
    };

    const handleFilterChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        params.delete("page");
        setSearchParams(params);
    };

    const handleDeleteSelected = (selectedIds: string[]) => {
        if (!confirm(`Haluatko varmasti poistaa ${selectedIds.length} tavaraa? / Delete ${selectedIds.length} items?`)) return;
        const formData = new FormData();
        formData.set("_action", "deleteMany");
        formData.set("itemIds", JSON.stringify(selectedIds));
        fetcher.submit(formData, { method: "POST" });
    };

    const handleReportSelected = (selectedIds: string[]) => {
        setSelectedForReport(selectedIds);
        setReportMessage("");
        setReportOpen(true);
    };

    const submitReport = () => {
        if (!reportMessage.trim()) return;
        const formData = new FormData();
        formData.set("_action", "report");
        formData.set("reportItemIds", JSON.stringify(selectedForReport));
        formData.set("reportMessage", reportMessage);
        fetcher.submit(formData, { method: "POST" });
        setReportOpen(false);
        setReportMessage("");
        setSelectedForReport([]);
    };

    // Column visibility menu using Popover (stays open on click)
    const columnVisibilityMenu = (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start">
                    <span className="material-symbols-outlined text-base mr-1">view_column</span>
                    Sarakkeet
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
                <div className="space-y-1">
                    {COLUMN_KEYS.map((key) => {
                        // Hide staff-only columns from non-staff
                        if (!isStaff && (key === "unitValue" || key === "totalValue" || key === "showInInfoReel")) return null;
                        return (
                            <label key={key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                <Checkbox
                                    checked={visibleColumns.has(key)}
                                    onCheckedChange={() => toggleColumn(key)}
                                />
                                <span className="text-sm">{COLUMN_LABELS[key]}</span>
                            </label>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );

    // Filter component with column visibility on same line
    const filterComponent = (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
                <Label htmlFor="name-filter" className="text-xs text-gray-500">Nimi / Name</Label>
                <Input
                    id="name-filter"
                    placeholder="Hae nimellä..."
                    defaultValue={filters.name}
                    onChange={(e) => handleFilterChange("name", e.target.value)}
                />
            </div>
            <div className="space-y-1">
                <Label htmlFor="location-filter" className="text-xs text-gray-500">Sijainti / Location</Label>
                <Select value={filters.location} onValueChange={(value) => handleFilterChange("location", value === "all" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Kaikki sijainnit..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Kaikki sijainnit</SelectItem>
                        {uniqueLocations.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label htmlFor="category-filter" className="text-xs text-gray-500">Kategoria / Category</Label>
                <Select value={filters.category} onValueChange={(value) => handleFilterChange("category", value === "all" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Kaikki kategoriat..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Kaikki kategoriat</SelectItem>
                        {uniqueCategories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs text-gray-500">Sarakkeet / Columns</Label>
                {columnVisibilityMenu}
            </div>
        </div>
    );

    // Actions component for batch operations
    const actionsComponent = (
        <Button
            variant="outline"
            size="sm"
            onClick={() => handleReportSelected(selectedForReport)}
            disabled={selectedForReport.length === 0}
        >
            <span className="material-symbols-outlined text-base mr-1">flag</span>
            Ilmoita / Report
        </Button>
    );

    // QR Panel for info reel
    const RightContent = (
        <QRPanel
            qrUrl="/inventory"
            title={
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    Tavaraluettelo <br />
                    <span className="text-lg text-gray-400 font-bold">Inventory</span>
                </h2>
            }
        />
    );

    const FooterContent = (
        <div className="flex items-center gap-2">
            {isAdmin && (
                <>
                    <a href="/api/inventory/export" className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Export CSV">
                        <span className="material-symbols-outlined text-xl">download</span>
                    </a>
                    <label className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer" title="Import">
                        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await fetch("/api/inventory/import", { method: "POST", body: formData });
                            const data = await res.json();
                            alert(data.success ? `Imported ${data.imported} items` : `Error: ${data.error}`);
                            if (data.success) window.location.reload();
                            e.target.value = "";
                        }} />
                        <span className="material-symbols-outlined text-xl">upload</span>
                    </label>
                </>
            )}
            {isStaff && <ActionButton href="/inventory/new" icon="add" labelFi="Lisää" labelEn="Add" external={false} />}
        </div>
    );

    // Static header
    const getHeader = () => {
        return { finnish: "Tavaraluettelo", english: "Inventory" };
    };

    // Info Reel mode: card display
    if (isInfoReel) {
        return (
            <PageWrapper>
                <SplitLayout right={RightContent} footer={FooterContent} header={getHeader()}>
                    <ContentArea>
                        {items.length > 0 ? (
                            <div className="space-y-4">
                                {items.map((item: InventoryItem) => (
                                    <div key={item.id} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                                        <h3 className="text-xl lg:text-2xl font-black text-gray-900 dark:text-white">{item.name}</h3>
                                        <div className="flex flex-wrap gap-2 text-sm">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
                                                <span className="material-symbols-outlined text-base">inventory_2</span>
                                                {item.quantity} kpl
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
                                                <span className="material-symbols-outlined text-base">location_on</span>
                                                {item.location}
                                            </span>
                                            {item.category && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
                                                    <span className="material-symbols-outlined text-base">category</span>
                                                    {item.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 text-center">
                                <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">inventory_2</span>
                                <p className="text-gray-600 dark:text-gray-400">Ei näytettäviä tavaroita / No items to display</p>
                            </div>
                        )}
                    </ContentArea>
                </SplitLayout>
            </PageWrapper>
        );
    }

    // Normal mode: data table
    return (
        <PageWrapper>
            <SplitLayout right={RightContent} footer={FooterContent} header={getHeader()}>
                <div className="space-y-4">
                    <DataTable
                        columns={columns}
                        data={items}
                        pageSize={pageSize}
                        isLoading={isLoading}
                        totalCount={totalCount}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                        filterComponent={filterComponent}
                        enableRowSelection={true}
                        onDeleteSelected={isStaff ? handleDeleteSelected : undefined}
                        getRowId={(row: InventoryItem) => row.id}
                        actionsComponent={actionsComponent}
                        onSelectionChange={(ids) => setSelectedForReport(ids)}
                    />
                </div>

                {/* Report Modal */}
                {reportOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setReportOpen(false)}>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-xl font-bold mb-4">Ilmoita tavarasta / Report Item</h3>
                            <p className="text-sm text-gray-500 mb-4">{selectedForReport.length} tavaraa valittu / items selected</p>
                            <textarea
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 bg-transparent"
                                rows={4}
                                placeholder="Kirjoita ilmoituksesi... / Write your report..."
                                value={reportMessage}
                                onChange={(e) => setReportMessage(e.target.value)}
                            />
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setReportOpen(false)}>Peruuta / Cancel</Button>
                                <Button onClick={submitReport} disabled={!reportMessage.trim()}>Lähetä / Send</Button>
                            </div>
                        </div>
                    </div>
                )}
            </SplitLayout>
        </PageWrapper>
    );
}
