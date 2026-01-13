import type { Route } from "./+types/inventory.new";
import { Form, redirect, useNavigate } from "react-router";
import { useState } from "react";
import { requireStaff } from "~/lib/auth.server";
import { getDatabase, type NewInventoryItem, type NewPurchase } from "~/db";
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

export function meta({ data }: Route.MetaArgs) {
    return [
        { title: `${data?.siteConfig?.name || "Portal"} - Uusi tavara / New Item` },
        { name: "robots", content: "noindex" },
    ];
}

export async function loader({ request }: Route.LoaderArgs) {
    await requireStaff(request, getDatabase);

    // Get recent minutes for dropdown
    const minutesByYear = await getMinutesByYear();
    const recentMinutes = minutesByYear.flatMap(year =>
        year.files.map(file => ({
            id: file.id,
            name: file.name,
            year: year.year,
        }))
    ).slice(0, 20); // Get 20 most recent

    return {
        siteConfig: SITE_CONFIG,
        recentMinutes,
        emailConfigured: isEmailConfigured(),
    };
}

export async function action({ request }: Route.ActionArgs) {
    await requireStaff(request, getDatabase);
    const db = getDatabase();

    const formData = await request.formData();
    const wasPurchased = formData.get("wasPurchased") === "on";

    // Create inventory item
    const newItem: NewInventoryItem = {
        name: formData.get("name") as string,
        quantity: parseInt(formData.get("quantity") as string) || 1,
        location: formData.get("location") as string,
        category: (formData.get("category") as string) || null,
        description: (formData.get("description") as string) || null,
        value: formData.get("value") as string || "0",
        purchasedAt: formData.get("purchasedAt")
            ? new Date(formData.get("purchasedAt") as string)
            : null,
    };

    const inventoryItem = await db.createInventoryItem(newItem);

    // If was purchased, create purchase record and send email
    if (wasPurchased) {
        const purchaserName = formData.get("purchaserName") as string;
        const bankAccount = formData.get("bankAccount") as string;
        const minutesId = formData.get("minutesId") as string;
        const notes = formData.get("notes") as string;
        const receiptFile = formData.get("receipt") as File | null;

        // Create purchase record
        const newPurchase: NewPurchase = {
            inventoryItemId: inventoryItem.id,
            description: newItem.name,
            amount: newItem.value || "0",
            purchaserName,
            bankAccount,
            minutesId: minutesId,
            minutesName: null,
            notes: notes || null,
            status: "pending",
            year: new Date().getFullYear(),
            emailSent: false,
        };

        await db.createPurchase(newPurchase);

        // Send email with receipt if file provided
        if (receiptFile && receiptFile.size > 0) {
            const arrayBuffer = await receiptFile.arrayBuffer();
            const base64Content = Buffer.from(arrayBuffer).toString("base64");

            await sendReimbursementEmail(
                {
                    itemName: newItem.name,
                    itemValue: newItem.value || "0",
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
        } else {
            // Send email without attachment
            await sendReimbursementEmail({
                itemName: newItem.name,
                itemValue: newItem.value || "0",
                purchaserName,
                bankAccount,
                minutesReference: minutesId || "Ei määritetty / Not specified",
                notes,
            });
        }
    }

    return redirect("/inventory");
}

export default function NewInventoryItem({ loaderData }: Route.ComponentProps) {
    const { recentMinutes, emailConfigured } = loaderData ?? { recentMinutes: [] as Array<{ id: string; name: string; year: number }>, emailConfigured: false };
    const navigate = useNavigate();
    const [wasPurchased, setWasPurchased] = useState(false);

    return (
        <PageWrapper>
            <div className="w-full max-w-2xl mx-auto px-4">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white">
                        Uusi tavara
                    </h1>
                    <p className="text-lg text-gray-500">New Item</p>
                </div>

                <Form method="post" encType="multipart/form-data" className="space-y-6">
                    {/* Basic Item Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Tavaran tiedot / Item Details
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nimi / Name *</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    placeholder="Esim. Kahvinkeitin"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="quantity">Määrä / Quantity *</Label>
                                <Input
                                    id="quantity"
                                    name="quantity"
                                    type="number"
                                    min="1"
                                    required
                                    defaultValue={1}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="location">Sijainti / Location *</Label>
                                <Input
                                    id="location"
                                    name="location"
                                    required
                                    placeholder="Esim. Kerhohuone"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Kategoria / Category</Label>
                                <Input
                                    id="category"
                                    name="category"
                                    placeholder="Esim. Keittiö"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Kuvaus / Description</Label>
                            <Input
                                id="description"
                                name="description"
                                placeholder="Vapaamuotoinen kuvaus"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="value">Arvo € / Value €</Label>
                                <Input
                                    id="value"
                                    name="value"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue="0"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="purchasedAt">Hankintapäivä / Purchase Date</Label>
                                <Input
                                    id="purchasedAt"
                                    name="purchasedAt"
                                    type="date"
                                    defaultValue={new Date().toISOString().split("T")[0]}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Purchase Reimbursement Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="wasPurchased"
                                name="wasPurchased"
                                checked={wasPurchased}
                                onCheckedChange={(checked) => setWasPurchased(checked === true)}
                            />
                            <Label htmlFor="wasPurchased" className="text-lg font-bold cursor-pointer">
                                Hankittu ostos / Was Purchased
                            </Label>
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Valitse jos tavara on ostettu ja haluat hakea kulukorvausta.
                            <br />
                            Check if the item was purchased and you want to request reimbursement.
                        </p>

                        {wasPurchased && (
                            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                {!emailConfigured && (
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                            ⚠️ Sähköpostilähetys ei ole konfiguroitu. Kuitti tallennetaan, mutta sähköpostia ei lähetetä.
                                            <br />
                                            Email sending is not configured. Receipt will be saved but email won't be sent.
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
                                        required={wasPurchased}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="purchaserName">Ostajan nimi / Purchaser Name *</Label>
                                        <Input
                                            id="purchaserName"
                                            name="purchaserName"
                                            required={wasPurchased}
                                            placeholder="Etu- ja sukunimi"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bankAccount">Tilinumero (IBAN) / Bank Account *</Label>
                                        <Input
                                            id="bankAccount"
                                            name="bankAccount"
                                            required={wasPurchased}
                                            placeholder="FI12 3456 7890 1234 56"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="minutesId">Pöytäkirja / Related Minutes</Label>
                                    <Select name="minutesId" defaultValue={recentMinutes[0]?.id || ""}>
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
                            {wasPurchased ? "Lisää ja lähetä kulukorvaus / Add & Submit Reimbursement" : "Lisää / Add"}
                        </Button>
                    </div>
                </Form>
            </div>
        </PageWrapper>
    );
}
