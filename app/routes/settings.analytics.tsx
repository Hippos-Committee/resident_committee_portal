import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Form, useActionData, useNavigation } from "react-router";
import { toast } from "sonner";
import { PageWrapper } from "~/components/layout/page-layout";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { getDatabase } from "~/db";
import { requirePermission } from "~/lib/auth.server";
import {
    getAvailableModels,
    type OpenRouterModel,
    SETTINGS_KEYS,
} from "~/lib/openrouter.server";
import type { Route } from "./+types/settings.analytics";

export function meta() {
    return [
        { title: "Analytics Settings" },
        { name: "robots", content: "noindex" },
    ];
}

export async function loader({ request }: Route.LoaderArgs) {
    await requirePermission(request, "settings:analytics", getDatabase);

    const db = getDatabase();
    const [apiKey, analyticsModel] = await Promise.all([
        db.getSetting(SETTINGS_KEYS.OPENROUTER_API_KEY),
        db.getSetting(SETTINGS_KEYS.ANALYTICS_AI_MODEL),
    ]);

    let models: OpenRouterModel[] = [];
    if (apiKey) {
        models = await getAvailableModels(apiKey);
    }

    return {
        apiKey: apiKey ? "••••••••" : "",
        hasApiKey: !!apiKey,
        analyticsModel: analyticsModel || "",
        models,
    };
}

export async function action({ request }: Route.ActionArgs) {
    await requirePermission(request, "settings:analytics", getDatabase);

    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const db = getDatabase();

    if (intent === "save-analytics-settings") {
        const model = formData.get("analyticsModel") as string;
        if (model) {
            await db.setSetting(
                SETTINGS_KEYS.ANALYTICS_AI_MODEL,
                model,
                "AI model for analytics word counting",
            );
        }
        return { success: true, message: "Analytics settings saved" };
    }

    return { error: "Unknown action" };
}

export default function SettingsAnalytics({ loaderData }: Route.ComponentProps) {
    const { hasApiKey, analyticsModel: serverModel, models } = loaderData;
    const { t } = useTranslation();
    const navigation = useNavigation();
    const actionData = useActionData<typeof action>();
    const isSubmitting = navigation.state === "submitting";

    const [model, setModel] = useState(serverModel);
    const [sortBy, setSortBy] = useState<"price" | "name">("price");

    useEffect(() => {
        if (actionData) {
            if (actionData.error) {
                toast.error(actionData.error);
            } else if (actionData.success) {
                toast.success(actionData.message);
            }
        }
    }, [actionData]);

    // Sort models
    const sortedModels = [...models].sort((a, b) => {
        if (sortBy === "price") {
            return a.pricing.prompt - b.pricing.prompt;
        }
        return a.name.localeCompare(b.name);
    });

    const formatPrice = (price: number) => {
        if (price === 0) return "Free";
        if (price < 0.01) return `$${price.toFixed(4)}`;
        return `$${price.toFixed(2)}`;
    };

    return (
        <PageWrapper>
            <div className="w-full max-w-2xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white">
                        Analytics Settings
                    </h1>
                </div>

                <div className="space-y-6">
                    {!hasApiKey && (
                        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-900/20">
                            <CardHeader>
                                <CardTitle className="text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                                    <span className="material-symbols-outlined">warning</span>
                                    AI Features Disabled
                                </CardTitle>
                                <CardDescription className="text-yellow-700 dark:text-yellow-300">
                                    Please configure the OpenRouter API Key in General Settings first.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="outline" asChild>
                                    <a href="/settings/general">Go to General Settings</a>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    <Card className={!hasApiKey ? "opacity-50 pointer-events-none" : ""}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="material-symbols-outlined">bar_chart</span>
                                AI Analysis Model
                            </CardTitle>
                            <CardDescription>
                                Select the AI model used for analyzing text responses and generating word clouds.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form method="post" className="space-y-4">
                                <input type="hidden" name="intent" value="save-analytics-settings" />
                                <input type="hidden" name="analyticsModel" value={model} />

                                {hasApiKey && models.length > 0 && (
                                    <>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Label>Sort models by</Label>
                                            <Button
                                                type="button"
                                                variant={sortBy === "price" ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setSortBy("price")}
                                            >
                                                Price
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={sortBy === "name" ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setSortBy("name")}
                                            >
                                                Name
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Select Model</Label>
                                            <Select value={model} onValueChange={setModel}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a model..." />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-64">
                                                    {sortedModels.slice(0, 50).map((m) => (
                                                        <SelectItem key={m.id} value={m.id}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="truncate max-w-[200px]">
                                                                    {m.name}
                                                                </span>
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {formatPrice(m.pricing.prompt)}/1M
                                                                </Badge>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                Showing top {Math.min(50, sortedModels.length)} models
                                            </p>
                                        </div>
                                    </>
                                )}

                                <Button type="submit" disabled={isSubmitting || !hasApiKey}>
                                    {isSubmitting ? "Saving..." : "Save Settings"}
                                </Button>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageWrapper>
    );
}
