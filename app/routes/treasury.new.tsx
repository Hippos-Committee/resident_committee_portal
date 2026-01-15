import type { Route } from "./+types/treasury.new";
import { Form, redirect, useNavigate, useFetcher } from "react-router";
import { useState } from "react";
import { requireStaff } from "~/lib/auth.server";
import { getDatabase, type NewTransaction, type NewPurchase, type NewInventoryItem, type InventoryItem } from "~/db";
import { getMinutesByYear } from "~/lib/google.server";
import { sendReimbursementEmail, isEmailConfigured } from "~/lib/email.server";
import { SITE_CONFIG } from "~/lib/config.server";
import { PageWrapper } from "~/components/layout/page-layout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog";
import { InventoryPicker } from "~/components/inventory-picker";

// Category options for transactions
const CATEGORY_OPTIONS = [
    { value: "inventory", label: "Tavarat / Inventory" },
    { value: "snacks", label: "Eväät / Snacks" },
    { value: "supplies", label: "Tarvikkeet / Supplies" },
    { value: "event", label: "Tapahtuma / Event" },
    { value: "other", label: "Muu / Other" },
] as const;

export function meta({ data }: Route.MetaArgs) {
    return [
        { title: `${data?.siteConfig?.name || "Portal"} - Uusi tapahtuma / New Transaction` },
        { name: "robots", content: "noindex" },
    ];
}

export async function loader({ request }: Route.LoaderArgs) {
    await requireStaff(request, getDatabase);
    const db = getDatabase();

    // Parse URL params for pre-fill
    const url = new URL(request.url);
    const itemIds = url.searchParams.get("items")?.split(",").filter(Boolean) || [];
    const prefillAmount = url.searchParams.get("amount") || "";
    const prefillDescription = url.searchParams.get("description") || "";
    const prefillType = url.searchParams.get("type") as "income" | "expense" | null;
    const prefillCategory = url.searchParams.get("category") || (itemIds.length > 0 ? "inventory" : "");

    // If items provided, fetch their details
    let linkedItems: { id: string; name: string; quantity: number; value: string | null }[] = [];
    if (itemIds.length > 0) {
        for (const id of itemIds) {
            const item = await db.getInventoryItemById(id);
            if (item) {
                linkedItems.push({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    value: item.value,
                });
            }
        }
    }

    // Get inventory items without linked transactions (for picker)
    const unlinkedInventoryItems = await db.getInventoryItemsWithoutTransactions();

    // Get unique locations and categories for picker filters
    const allInventoryItems = await db.getInventoryItems();
    const uniqueLocations = [...new Set(allInventoryItems.map(item => item.location).filter(Boolean))].sort();
    const uniqueCategories = [...new Set(allInventoryItems.map(item => item.category).filter(Boolean) as string[])].sort();

    // Get recent minutes for dropdown
    const minutesByYear = await getMinutesByYear();
    const recentMinutes = minutesByYear.flatMap(year =>
        year.files.map(file => ({
            id: file.id,
            name: file.name,
            year: year.year,
        }))
    ).slice(0, 20);

    return {
        siteConfig: SITE_CONFIG,
        currentYear: new Date().getFullYear(),
        recentMinutes,
        emailConfigured: isEmailConfigured(),
        // Pre-fill data
        prefill: {
            amount: prefillAmount,
            description: prefillDescription,
            type: prefillType || "expense",
            category: prefillCategory,
            itemIds: itemIds.join(","),
        },
        linkedItems,
        // Inventory picker data
        unlinkedInventoryItems,
        uniqueLocations,
        uniqueCategories,
    };
}

export async function action({ request }: Route.ActionArgs) {
    await requireStaff(request, getDatabase);
    const db = getDatabase();

    const formData = await request.formData();
    const actionType = formData.get("_action");

    // Handle createItem action for InventoryPicker
    if (actionType === "createItem") {
        const name = formData.get("name") as string;
        const quantity = parseInt(formData.get("quantity") as string) || 1;
        const location = formData.get("location") as string;
        const category = (formData.get("category") as string) || null;
        const description = (formData.get("description") as string) || null;
        const value = (formData.get("value") as string) || "0";

        const newItem: NewInventoryItem = {
            name,
            quantity,
            location,
            category,
            description,
            value,
            showInInfoReel: false,
        };

        const item = await db.createInventoryItem(newItem);
        return { success: true, item };
    }

    const type = formData.get("type") as "income" | "expense";
    const amount = formData.get("amount") as string;
    const description = formData.get("description") as string;
    const category = (formData.get("category") as string) || null;
    const dateString = formData.get("date") as string;
    const year = parseInt(formData.get("year") as string);
    const requestReimbursement = formData.get("requestReimbursement") === "on";

    // Determine status based on reimbursement request
    const status = requestReimbursement ? "pending" : "complete";
    const reimbursementStatus = requestReimbursement ? "requested" : "not_requested";

    // Create purchase record if reimbursement requested
    let purchaseId: string | null = null;

    if (requestReimbursement) {
        const purchaserName = formData.get("purchaserName") as string;
        const bankAccount = formData.get("bankAccount") as string;
        const minutesId = formData.get("minutesId") as string;
        const notes = formData.get("notes") as string;
        const receiptFile = formData.get("receipt") as File | null;

        const newPurchase: NewPurchase = {
            description,
            amount,
            purchaserName,
            bankAccount,
            minutesId,
            minutesName: null,
            notes: notes || null,
            status: "pending",
            year,
            emailSent: false,
        };

        const purchase = await db.createPurchase(newPurchase);
        purchaseId = purchase.id;

        // Send email with receipt if file provided
        if (receiptFile && receiptFile.size > 0) {
            try {
                const arrayBuffer = await receiptFile.arrayBuffer();
                const base64Content = Buffer.from(arrayBuffer).toString("base64");

                await sendReimbursementEmail(
                    {
                        itemName: description,
                        itemValue: amount,
                        purchaserName,
                        bankAccount,
                        minutesReference: minutesId || "Ei määritetty / Not specified",
                        notes,
                    },
                    {
                        name: receiptFile.name,
                        type: receiptFile.type,
                        content: base64Content,
                    }
                );

                await db.updatePurchase(purchase.id, { emailSent: true });
            } catch (error) {
                await db.updatePurchase(purchase.id, {
                    emailError: error instanceof Error ? error.message : "Unknown error",
                });
            }
        } else {
            // Send email without attachment
            try {
                await sendReimbursementEmail({
                    itemName: description,
                    itemValue: amount,
                    purchaserName,
                    bankAccount,
                    minutesReference: minutesId || "Ei määritetty / Not specified",
                    notes,
                });
                await db.updatePurchase(purchase.id, { emailSent: true });
            } catch (error) {
                await db.updatePurchase(purchase.id, {
                    emailError: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }
    }

    const newTransaction: NewTransaction = {
        type,
        amount,
        description,
        category,
        date: new Date(dateString),
        year,
        status,
        reimbursementStatus,
        purchaseId,
    };

    const transaction = await db.createTransaction(newTransaction);

    // Link inventory items to transaction if provided
    const linkedItemIds = formData.get("linkedItemIds") as string;
    if (linkedItemIds) {
        const ids = linkedItemIds.split(",").filter(Boolean);
        for (const itemId of ids) {
            const item = await db.getInventoryItemById(itemId);
            if (item) {
                await db.linkInventoryItemToTransaction(itemId, transaction.id, item.quantity);
            }
        }
    }

    return redirect(`/treasury?year=${year}`);
}

export default function NewTransaction({ loaderData }: Route.ComponentProps) {
    const {
        currentYear,
        recentMinutes,
        emailConfigured,
        prefill,
        linkedItems,
        unlinkedInventoryItems,
        uniqueLocations,
        uniqueCategories,
    } = loaderData ?? {
        currentYear: new Date().getFullYear(),
        recentMinutes: [] as Array<{ id: string; name: string; year: number }>,
        emailConfigured: false,
        prefill: { amount: "", description: "", type: "expense" as const, category: "", itemIds: "" },
        linkedItems: [] as Array<{ id: string; name: string; quantity: number; value: string | null }>,
        unlinkedInventoryItems: [] as InventoryItem[],
        uniqueLocations: [] as string[],
        uniqueCategories: [] as string[],
    };
    const navigate = useNavigate();
    const fetcher = useFetcher();
    const [requestReimbursement, setRequestReimbursement] = useState(false);
    const [inventoryOpen, setInventoryOpen] = useState(false);

    // State for category and selected inventory items
    const [selectedCategory, setSelectedCategory] = useState(prefill.category || "");
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
        prefill.itemIds ? prefill.itemIds.split(",").filter(Boolean) : []
    );

    // Combined items: unlinked + any pre-selected linked items (for editing)
    // Dedupe by ID to avoid showing items twice
    const availableItemsMap = new Map<string, InventoryItem>();

    // Add unlinked items first (these have full data)
    for (const item of unlinkedInventoryItems) {
        availableItemsMap.set(item.id, item);
    }

    // Only add linked items if they're NOT already in the map
    // (linked items have sparse data, so we prefer unlinked ones)
    for (const li of linkedItems) {
        if (!availableItemsMap.has(li.id)) {
            availableItemsMap.set(li.id, {
                ...li,
                location: "",
                category: null,
                description: null,
                showInInfoReel: false,
                purchasedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as InventoryItem);
        }
    }

    const availableItems = Array.from(availableItemsMap.values());

    // Generate year options (last 5 years)
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

    // Calculate total from selected items
    const selectedItemsTotal = selectedItemIds.reduce((sum, id) => {
        const item = availableItems.find(i => i.id === id);
        if (item?.value) {
            return sum + (parseFloat(item.value) * (item.quantity || 1));
        }
        return sum;
    }, 0);

    // Handler for adding new inventory item from picker
    const handleAddItem = async (itemData: {
        name: string;
        quantity: number;
        location: string;
        category?: string;
        description?: string;
        value?: string;
    }): Promise<InventoryItem | null> => {
        // Use fetcher to create the item
        const formData = new FormData();
        formData.set("_action", "createItem");
        formData.set("name", itemData.name);
        formData.set("quantity", itemData.quantity.toString());
        formData.set("location", itemData.location);
        formData.set("category", itemData.category || "");
        formData.set("description", itemData.description || "");
        formData.set("value", itemData.value || "0");

        // For now, return null and let the component refresh
        // The fetcher will trigger a reload
        fetcher.submit(formData, { method: "POST" });
        return null;
    };

    return (
        <PageWrapper>
            <div className="w-full max-w-2xl mx-auto px-4">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white">
                        Uusi tapahtuma
                    </h1>
                    <p className="text-lg text-gray-500">New Transaction</p>
                </div>



                <Form method="post" encType="multipart/form-data" className="space-y-6">
                    {/* Hidden field for selected item IDs */}
                    <input type="hidden" name="linkedItemIds" value={selectedItemIds.join(",")} />

                    {/* Transaction Details */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Tapahtuman tiedot / Transaction Details
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Tyyppi / Type *</Label>
                                <Select name="type" defaultValue={prefill.type} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Valitse tyyppi..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="income">
                                            <span className="flex items-center gap-2">
                                                <span className="text-green-600">+</span>
                                                Tulo / Income
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="expense">
                                            <span className="flex items-center gap-2">
                                                <span className="text-red-600">-</span>
                                                Meno / Expense
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Summa € / Amount € *</Label>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    required
                                    placeholder="0.00"
                                    defaultValue={prefill.amount}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Kuvaus / Description *</Label>
                            <Input
                                id="description"
                                name="description"
                                required
                                placeholder="Esim. Kahvitarjoilut, Kokoukseen hankitut eväät"
                                defaultValue={prefill.description}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="category">Kategoria / Category *</Label>
                                <Select
                                    name="category"
                                    value={selectedCategory}
                                    onValueChange={setSelectedCategory}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Valitse kategoria..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORY_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date">Päivämäärä / Date *</Label>
                                <Input
                                    id="date"
                                    name="date"
                                    type="date"
                                    required
                                    defaultValue={new Date().toISOString().split("T")[0]}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="year">Vuosi / Year *</Label>
                            <Select name="year" defaultValue={currentYear.toString()} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Valitse vuosi..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map((year) => (
                                        <SelectItem key={year} value={year.toString()}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Inventory Selection Section - shown when category is "inventory" */}
                    {selectedCategory === "inventory" && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined">inventory_2</span>
                                        Tavarat / Items
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {selectedItemIds.length === 0
                                            ? "Ei valittuja tavaroita / No items selected"
                                            : `${selectedItemIds.length} tavaraa valittu / items selected`
                                        }
                                    </p>
                                </div>
                                {selectedItemsTotal > 0 && (
                                    <div className="text-right">
                                        <span className="block text-sm font-medium text-gray-500">Yhteensä / Total</span>
                                        <span className="text-lg font-bold text-primary">
                                            {selectedItemsTotal.toFixed(2).replace(".", ",")} €
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Selected Items List (Preview) */}
                            {selectedItemIds.length > 0 && (
                                <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                                    {selectedItemIds.map(id => {
                                        const item = availableItems.find(i => i.id === id);
                                        if (!item) return null;
                                        return (
                                            <div key={id} className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-gray-400 text-lg">package_2</span>
                                                    <span>{item.name} <span className="text-gray-500 text-xs">x{item.quantity}</span></span>
                                                </div>
                                                {item.value && item.value !== "0" && (
                                                    <span className="text-gray-500 font-mono">
                                                        {(parseFloat(item.value) * item.quantity).toFixed(2).replace(".", ",")} €
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <Dialog open={inventoryOpen} onOpenChange={setInventoryOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full border-dashed border-2 py-8 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        <span className="material-symbols-outlined mr-2">add_circle</span>
                                        {selectedItemIds.length > 0 ? "Muokkaa valintaa / Edit Selection" : "Valitse tavarat / Select Items"}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-6">
                                    <DialogHeader>
                                        <DialogTitle>Valitse tavarat / Select Items</DialogTitle>
                                        <DialogDescription>
                                            Valitse listalta tai lisää uusi tavara. / Select from list or add new.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex-1 overflow-auto min-h-0 -mx-2 px-2">
                                        <InventoryPicker
                                            items={availableItems}
                                            uniqueLocations={uniqueLocations}
                                            uniqueCategories={uniqueCategories}
                                            selectedIds={selectedItemIds}
                                            onSelectionChange={setSelectedItemIds}
                                            onAddItem={handleAddItem}
                                            compact={false}
                                            showUnlinkedBadge={true}
                                        />
                                    </div>
                                    <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <Button onClick={() => setInventoryOpen(false)}>
                                            Valmis / Done
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}

                    {/* Reimbursement Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="requestReimbursement"
                                name="requestReimbursement"
                                checked={requestReimbursement}
                                onCheckedChange={(checked) => setRequestReimbursement(checked === true)}
                            />
                            <Label htmlFor="requestReimbursement" className="text-lg font-bold cursor-pointer">
                                Hae kulukorvausta / Request Reimbursement
                            </Label>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Valitse jos haluat hakea kulukorvausta tästä menosta määrärahasta.
                            <br />
                            Check if you want to request reimbursement from the allowance.
                        </p>

                        {requestReimbursement && (
                            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                {!emailConfigured && (
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                            ⚠️ Sähköpostilähetys ei ole konfiguroitu. Pyyntö tallennetaan, mutta sähköpostia ei lähetetä.
                                            <br />
                                            Email sending is not configured. Request will be saved but email won't be sent.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="receipt">Kuitti / Receipt (PDF tai kuva) *</Label>
                                    <Input
                                        id="receipt"
                                        name="receipt"
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                                        required={requestReimbursement}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="purchaserName">Ostajan nimi / Purchaser Name *</Label>
                                        <Input
                                            id="purchaserName"
                                            name="purchaserName"
                                            required={requestReimbursement}
                                            placeholder="Etu- ja sukunimi"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bankAccount">Tilinumero (IBAN) / Bank Account *</Label>
                                        <Input
                                            id="bankAccount"
                                            name="bankAccount"
                                            required={requestReimbursement}
                                            placeholder="FI12 3456 7890 1234 56"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="minutesId">Pöytäkirja / Related Minutes *</Label>
                                    <Select name="minutesId" defaultValue={recentMinutes[0]?.id || ""} required={requestReimbursement}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Valitse pöytäkirja..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {recentMinutes.map((minute) => (
                                                <SelectItem key={minute.id} value={minute.id}>
                                                    {minute.name} ({minute.year})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-500">
                                        Yli 100€ hankinnoissa pöytäkirja vaaditaan ennen maksua.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="notes">Lisätiedot / Additional Notes</Label>
                                    <textarea
                                        id="notes"
                                        name="notes"
                                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                                        placeholder="Vapaamuotoinen viesti..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate(-1)}
                            className="flex-1"
                        >
                            Peruuta / Cancel
                        </Button>
                        <Button type="submit" className="flex-1">
                            {requestReimbursement
                                ? "Lisää ja hae korvausta / Add & Request Reimbursement"
                                : "Lisää / Add"
                            }
                        </Button>
                    </div>
                </Form>
            </div>
        </PageWrapper>
    );
}

