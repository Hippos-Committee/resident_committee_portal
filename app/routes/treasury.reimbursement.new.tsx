import type { Route } from "./+types/treasury.reimbursement.new";
import { Form, redirect, useNavigate, useActionData, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { requirePermission } from "~/lib/auth.server";
import { getDatabase, type NewPurchase, type NewInventoryItem } from "~/db";
import { getMinutesByYear, getFileAsBase64 } from "~/lib/google.server";
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

interface MinuteFile {
    id: string;
    name: string;
    url: string;
    year: string;
}

export function meta({ data }: Route.MetaArgs) {
    return [
        { title: `${data?.siteConfig?.name || "Portal"} - Uusi kulukorvaus / New Reimbursement` },
        { name: "robots", content: "noindex" },
    ];
}

export async function loader({ request }: Route.LoaderArgs) {
    await requirePermission(request, "reimbursements:write", getDatabase);

    const minutesByYear = await getMinutesByYear();
    const recentMinutes: MinuteFile[] = minutesByYear.flatMap(year =>
        year.files.map(file => ({
            id: file.id,
            name: file.name,
            url: file.url,
            year: year.year,
        }))
    ).slice(0, 20);

    return {
        siteConfig: SITE_CONFIG,
        recentMinutes,
        emailConfigured: isEmailConfigured(),
        currentYear: new Date().getFullYear(),
    };
}

export async function action({ request }: Route.ActionArgs) {
    await requirePermission(request, "reimbursements:write", getDatabase);
    const db = getDatabase();
    const formData = await request.formData();

    const description = formData.get("description") as string;
    const amount = formData.get("amount") as string;
    const purchaserName = formData.get("purchaserName") as string;
    const bankAccount = formData.get("bankAccount") as string;
    const minutesId = formData.get("minutesId") as string;
    const minutesName = formData.get("minutesName") as string;
    let minutesUrl = formData.get("minutesUrl") as string;

    // Ensure we have a valid URL for the minutes
    if (!minutesUrl && minutesId) {
        minutesUrl = `https://drive.google.com/file/d/${minutesId}/view`;
    }
    const notes = formData.get("notes") as string;
    const addToInventory = formData.get("addToInventory") === "on";
    const receiptFiles = formData.getAll("receipt") as File[];
    const currentYear = new Date().getFullYear();

    let inventoryItemId: string | null = null;

    // Create inventory item if requested
    if (addToInventory) {
        const location = formData.get("location") as string;
        const category = formData.get("category") as string;

        const newItem: NewInventoryItem = {
            name: description,
            quantity: 1,
            location: location || "Ei määritetty",
            category: category || null,
            value: amount,
            purchasedAt: new Date(),
        };

        const item = await db.createInventoryItem(newItem);
        inventoryItemId = item.id;
    }

    // Create purchase
    const newPurchase: NewPurchase = {
        inventoryItemId,
        description,
        amount,
        purchaserName,
        bankAccount,
        minutesId,
        minutesName,
        notes: notes || null,
        status: "pending",
        year: currentYear,
        emailSent: false,
    };

    const purchase = await db.createPurchase(newPurchase);

    // Send email with receipt(s) and minutes PDF
    try {
        const receiptAttachments: { name: string; type: string; content: string }[] = [];
        for (const receiptFile of receiptFiles) {
            if (receiptFile && receiptFile.size > 0) {
                const arrayBuffer = await receiptFile.arrayBuffer();
                receiptAttachments.push({
                    name: receiptFile.name,
                    type: receiptFile.type,
                    content: Buffer.from(arrayBuffer).toString("base64"),
                });
            }
        }

        // Fetch minutes PDF from Google Drive
        let minutesAttachment;
        if (minutesId) {
            try {
                const minutesPdf = await getFileAsBase64(minutesId);
                if (minutesPdf) {
                    minutesAttachment = {
                        name: `${minutesName || "poytakirja"}.pdf`,
                        type: "application/pdf",
                        content: minutesPdf,
                    };
                }
            } catch (e) {
                console.error("[Reimbursement] Failed to fetch minutes PDF:", e);
            }
        }

        const emailResult = await sendReimbursementEmail(
            {
                itemName: description,
                itemValue: amount,
                purchaserName,
                bankAccount,
                minutesReference: minutesName || minutesId,
                minutesUrl,
                notes,
            },
            purchase.id,
            receiptAttachments.length > 0 ? receiptAttachments : undefined,
            minutesAttachment
        );

        if (emailResult.success) {
            await db.updatePurchase(purchase.id, {
                emailSent: true,
                emailMessageId: emailResult.messageId,
            });
        } else {
            await db.updatePurchase(purchase.id, { emailError: emailResult.error || "Email sending failed" });
        }
    } catch (error) {
        console.error("[Reimbursement] Email error:", error);
        await db.updatePurchase(purchase.id, {
            emailError: error instanceof Error ? error.message : "Unknown error"
        });
    }

    return redirect("/budget/reimbursements?success=true");
}

export default function NewReimbursement({ loaderData }: Route.ComponentProps) {
    const { recentMinutes, emailConfigured, currentYear } = loaderData;
    const navigate = useNavigate();
    const [addToInventory, setAddToInventory] = useState(false);
    const [selectedMinutes, setSelectedMinutes] = useState<MinuteFile | null>(recentMinutes[0] || null);

    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <PageWrapper>
            <div className="w-full max-w-2xl mx-auto px-4">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white">
                        Uusi kulukorvaus
                    </h1>
                    <p className="text-lg text-gray-500">New Reimbursement</p>
                </div>

                <Form method="post" encType="multipart/form-data" className="space-y-6">
                    {/* Purchase Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <h2 className="text-lg font-bold">Ostoksen tiedot / Purchase Details</h2>

                        {!emailConfigured && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                    ⚠️ Sähköposti ei konfiguroitu / Email not configured
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="description">Kuvaus / Description *</Label>
                            <Input
                                id="description"
                                name="description"
                                required
                                placeholder="Esim. Kahvitarjoilu kokoukseen"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Summa € / Amount € *</Label>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="receipt">Kuitit / Receipts *</Label>
                                <Input
                                    id="receipt"
                                    name="receipt"
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    required
                                    multiple
                                />
                                <p className="text-xs text-muted-foreground">
                                    Voit valita useita tiedostoja (Ctrl/Cmd + klikkaus) / Select multiple files (Ctrl/Cmd + click)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Purchaser Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <h2 className="text-lg font-bold">Ostajan tiedot / Purchaser Info</h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="purchaserName">Nimi / Name *</Label>
                                <Input
                                    id="purchaserName"
                                    name="purchaserName"
                                    required
                                    placeholder="Etu- ja sukunimi"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bankAccount">Tilinumero (IBAN) *</Label>
                                <Input
                                    id="bankAccount"
                                    name="bankAccount"
                                    required
                                    placeholder="FI12 3456 7890 1234 56"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Minutes Reference */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <h2 className="text-lg font-bold">Pöytäkirja / Minutes *</h2>
                        <p className="text-sm text-gray-500">Valitse kokous jossa osto hyväksyttiin / Select the meeting where this was approved</p>

                        <Select
                            name="minutesId"
                            required
                            defaultValue={recentMinutes[0]?.id}
                            onValueChange={(value) => {
                                const selected = recentMinutes.find((m: MinuteFile) => m.id === value);
                                setSelectedMinutes(selected || null);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Valitse pöytäkirja..." />
                            </SelectTrigger>
                            <SelectContent>
                                {recentMinutes.map((minute: MinuteFile) => (
                                    <SelectItem key={minute.id} value={minute.id}>
                                        {minute.name} ({minute.year})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <input type="hidden" name="minutesName" value={selectedMinutes?.name || ""} />
                        <input
                            type="hidden"
                            name="minutesUrl"
                            value={selectedMinutes?.url || (selectedMinutes?.id ? `https://drive.google.com/file/d/${selectedMinutes.id}/view` : "")}
                        />
                    </div>

                    {/* Notes */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <Label htmlFor="notes">Lisätiedot / Notes</Label>
                        <textarea
                            id="notes"
                            name="notes"
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                            placeholder="Vapaamuotoinen viesti..."
                        />
                    </div>

                    {/* Add to Inventory */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="addToInventory"
                                name="addToInventory"
                                checked={addToInventory}
                                onCheckedChange={(checked: boolean) => setAddToInventory(checked)}
                            />
                            <Label htmlFor="addToInventory" className="cursor-pointer">
                                Lisää myös inventaarioon / Also add to inventory
                            </Label>
                        </div>

                        {addToInventory && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="space-y-2">
                                    <Label htmlFor="location">Sijainti / Location</Label>
                                    <Input id="location" name="location" placeholder="Esim. Kerhohuone" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Kategoria / Category</Label>
                                    <Input id="category" name="category" placeholder="Esim. Keittiö" />
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
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                    <span>Lähetetään... / Submitting...</span>
                                </span>
                            ) : "Lähetä / Submit"}
                        </Button>
                    </div>
                </Form>
            </div>
        </PageWrapper>
    );
}
