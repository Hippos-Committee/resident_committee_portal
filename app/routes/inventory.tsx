import type { Route } from "./+types/inventory";
import { Form, Link, useRouteLoaderData } from "react-router";
import { PageWrapper, SplitLayout, QRPanel, ActionButton, ContentArea } from "~/components/layout/page-layout";
import { SearchMenu, type SearchField } from "~/components/search-menu";
import { getDatabase, type InventoryItem } from "~/db";
import { SITE_CONFIG } from "~/lib/config.server";
import type { loader as rootLoader } from "~/root";
import { cn } from "~/lib/utils";

export function meta({ data }: Route.MetaArgs) {
    // Dynamic title based on filters
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

    const hasFilters = nameFilter || locationFilter || categoryFilter;

    // Fetch from database
    const allItems = await db.getInventoryItems();

    let items = [...allItems];

    // Apply filters
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

    // Sort by value descending
    items = items.sort((a, b) => parseFloat(b.value || "0") - parseFloat(a.value || "0"));

    // If no filters, show top 3 by value
    if (!hasFilters) {
        items = items.slice(0, 3);
    }

    // Get unique locations and categories for search dropdowns
    const uniqueLocations = [...new Set(allItems.map(item => item.location).filter(Boolean))].sort();
    const uniqueCategories = [...new Set(allItems.map(item => item.category).filter(Boolean) as string[])].sort();

    return {
        siteConfig: SITE_CONFIG,
        items,
        filters: { name: nameFilter, location: locationFilter, category: categoryFilter },
        hasFilters,
        uniqueLocations,
        uniqueCategories,
        totalCount: allItems.length,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const db = getDatabase();
    const formData = await request.formData();
    const actionType = formData.get("_action");
    const itemId = formData.get("itemId") as string;

    if (actionType === "delete" && itemId) {
        // Delete related purchases first (cascade)
        const purchases = await db.getPurchasesByInventoryItem(itemId);
        for (const purchase of purchases) {
            await db.deletePurchase(purchase.id);
        }
        // Then delete the inventory item
        await db.deleteInventoryItem(itemId);
    }

    return { success: true };
}

export default function Inventory({ loaderData }: Route.ComponentProps) {
    const { items, filters, hasFilters, uniqueLocations, uniqueCategories, totalCount } = loaderData;
    const rootData = useRouteLoaderData<typeof rootLoader>("root");
    const isStaff = rootData?.user?.role === "admin" || rootData?.user?.role === "board_member";
    const isAdmin = rootData?.user?.role === "admin";

    // Configure search fields with dropdown options
    const searchFields: SearchField[] = [
        {
            name: "name",
            label: "Nimi / Name",
            type: "text",
            placeholder: "Hae nimellä...",
        },
        {
            name: "location",
            label: "Sijainti / Location",
            type: "select",
            placeholder: "Valitse sijainti...",
            options: uniqueLocations,
        },
        {
            name: "category",
            label: "Kategoria / Category",
            type: "select",
            placeholder: "Valitse kategoria...",
            options: uniqueCategories,
        },
    ];

    // QR Panel only shown in info reel mode
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

    // Header actions: Search + Add button for staff + Import/Export for admin
    const FooterContent = (
        <div className="flex items-center gap-2">
            <SearchMenu fields={searchFields} />
            {isAdmin && (
                <>
                    <a
                        href="/api/inventory/export"
                        className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Vie CSV / Export CSV"
                    >
                        <span className="material-symbols-outlined text-xl">download</span>
                    </a>
                    <label className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        title="Tuo tiedosto / Import file (CSV/Excel)"
                    >
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                const formData = new FormData();
                                formData.append("file", file);

                                const res = await fetch("/api/inventory/import", {
                                    method: "POST",
                                    body: formData,
                                });

                                const data = await res.json();
                                if (data.success) {
                                    alert(`Tuotu ${data.imported} tavaraa / Imported ${data.imported} items`);
                                    window.location.reload();
                                } else {
                                    alert(`Virhe: ${data.error} / Error: ${data.error}`);
                                }

                                e.target.value = "";
                            }}
                        />
                        <span className="material-symbols-outlined text-xl">upload</span>
                    </label>
                </>
            )}
            {isStaff && (
                <ActionButton
                    href="/inventory/new"
                    icon="add"
                    labelFi="Lisää"
                    labelEn="Add"
                />
            )}
        </div>
    );

    // Build header based on filters
    const getHeader = () => {
        if (filters.location) {
            return { finnish: `Tavarat: ${filters.location}`, english: `Items: ${filters.location}` };
        }
        if (filters.category) {
            return { finnish: `Kategoria: ${filters.category}`, english: `Category: ${filters.category}` };
        }
        if (filters.name) {
            return { finnish: `Haku: "${filters.name}"`, english: `Search: "${filters.name}"` };
        }
        return { finnish: "Tavaraluettelo", english: "Inventory" };
    };

    const formatValue = (value: string | null) => {
        if (!value || value === "0") return null;
        return parseFloat(value).toFixed(2).replace(".", ",");
    };

    return (
        <PageWrapper>
            <SplitLayout
                right={RightContent}
                footer={FooterContent}
                header={getHeader()}
            >
                <div className="space-y-6">
                    {/* Back link when filtered */}
                    {hasFilters && (
                        <Link
                            to="/inventory"
                            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                        >
                            <span className="material-symbols-outlined text-base">arrow_back</span>
                            Kaikki tavarat / All Inventory
                        </Link>
                    )}

                    {/* Filter summary */}
                    {hasFilters && (
                        <p className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {filters.location && (
                                <span className="inline-flex items-center gap-1 mr-2">
                                    <span className="material-symbols-outlined text-base align-middle">location_on</span>
                                    {filters.location}
                                </span>
                            )}
                            {filters.category && (
                                <span className="inline-flex items-center gap-1 mr-2">
                                    <span className="material-symbols-outlined text-base align-middle">category</span>
                                    {filters.category}
                                </span>
                            )}
                            {filters.name && (
                                <span className="inline-flex items-center gap-1">
                                    <span className="material-symbols-outlined text-base align-middle">search</span>
                                    "{filters.name}"
                                </span>
                            )}
                            <span className="ml-2">— {items.length} {items.length === 1 ? "tavara" : "tavaraa"} / {items.length === 1 ? "item" : "items"}</span>
                        </p>
                    )}

                    {/* Show total count when not filtered */}
                    {!hasFilters && totalCount > 0 && (
                        <p className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Top 3 / {totalCount} tavaraa yhteensä
                        </p>
                    )}

                    {/* Scrollable items list */}
                    <ContentArea>
                        {items.length > 0 ? (
                            <div className="space-y-4">
                                {items.map((item: InventoryItem) => (
                                    <div
                                        key={item.id}
                                        className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 space-y-2"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="text-xl lg:text-2xl font-black text-gray-900 dark:text-white">
                                                {item.name}
                                            </h3>
                                            {isStaff && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Link
                                                        to={`/inventory/${item.id}/edit`}
                                                        className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                        title="Muokkaa / Edit"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">edit</span>
                                                    </Link>
                                                    <Form method="post" onSubmit={(e) => {
                                                        if (!confirm("Haluatko varmasti poistaa tämän tavaran? / Delete this item?")) {
                                                            e.preventDefault();
                                                        }
                                                    }}>
                                                        <input type="hidden" name="_action" value="delete" />
                                                        <input type="hidden" name="itemId" value={item.id} />
                                                        <button
                                                            type="submit"
                                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="Poista / Delete"
                                                        >
                                                            <span className="material-symbols-outlined text-xl">delete</span>
                                                        </button>
                                                    </Form>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-sm">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
                                                <span className="material-symbols-outlined text-base">inventory_2</span>
                                                {item.quantity} kpl
                                            </span>
                                            {/* Location as clickable filter */}
                                            <Link
                                                to={`/inventory?location=${encodeURIComponent(item.location)}`}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-primary/20 hover:text-primary transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-base">location_on</span>
                                                {item.location}
                                            </Link>
                                            {/* Category as clickable filter */}
                                            {item.category && (
                                                <Link
                                                    to={`/inventory?category=${encodeURIComponent(item.category)}`}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-primary/20 hover:text-primary transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-base">category</span>
                                                    {item.category}
                                                </Link>
                                            )}
                                            {formatValue(item.value) && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg font-bold">
                                                    <span className="material-symbols-outlined text-base">euro</span>
                                                    {formatValue(item.value)} €
                                                </span>
                                            )}
                                        </div>
                                        {item.description && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 text-center">
                                <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">inventory_2</span>
                                <p className="text-gray-600 dark:text-gray-400">
                                    {hasFilters ? "Ei tuloksia / No results" : "Ei tavaroita / No items yet"}
                                </p>
                                {isStaff && !hasFilters && (
                                    <Link
                                        to="/inventory/new"
                                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                        Lisää tavara / Add Item
                                    </Link>
                                )}
                            </div>
                        )}
                    </ContentArea>
                </div>
            </SplitLayout>
        </PageWrapper>
    );
}
