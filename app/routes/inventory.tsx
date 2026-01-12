import type { Route } from "./+types/inventory";
import { PageWrapper, SplitLayout, QRPanel, ActionButton } from "~/components/layout/page-layout";
import { getInventory } from "~/lib/google.server";
import { queryClient } from "~/lib/query-client";
import { queryKeys, STALE_TIME } from "~/lib/query-config";
import { SITE_CONFIG } from "~/lib/config.server";

export function meta({ data }: Route.MetaArgs) {
	return [
		{ title: `${data?.siteConfig?.name || "Portal"} - Tavaraluettelo / Inventory` },
		{ name: "description", content: "Toimikunnan tavaraluettelo / Tenant Committee Inventory" },
	];
}

export async function loader({}: Route.LoaderArgs) {
	const inventoryData = await queryClient.ensureQueryData({
		queryKey: queryKeys.inventory,
		queryFn: getInventory,
		staleTime: STALE_TIME,
	});

	return {
		siteConfig: SITE_CONFIG,
		topItems: inventoryData?.topItems || [],
		detailsUrl: inventoryData?.detailsUrl || "#",
	};
}

export default function Inventory({ loaderData }: Route.ComponentProps) {
    const { topItems, detailsUrl } = loaderData;

    // QR Panel only shown in info reel mode
    const RightContent = (
        <QRPanel
            qrUrl={detailsUrl}
            title={
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    Katso kaikki <br />
                    <span className="text-lg text-gray-400 font-bold">See All Items</span>
                </h2>
            }
        />
    );

    // Action button shown below content in regular mode
    const FooterContent = (
        <ActionButton
            href={detailsUrl}
            icon="table_chart"
            labelFi="Katso kaikki"
            labelEn="See All Items"
            external={true}
        />
    );

    return (
        <PageWrapper>
            <SplitLayout
                right={RightContent}
                footer={FooterContent}
                header={{ finnish: "Tavaraluettelo", english: "Inventory" }}
            >
                <div className="space-y-6">
                    <p className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Toimikunnan tavarat / Committee Items
                    </p>

                    {topItems.length > 0 ? (
                        <div className="space-y-4">
                            {topItems.map((item, index) => (
                                <div
                                    key={index}
                                    className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 space-y-2"
                                >
                                    <h3 className="text-xl lg:text-2xl font-black text-gray-900 dark:text-white">
                                        {item.name}
                                    </h3>
                                    <div className="flex flex-wrap gap-2 text-sm">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
                                            <span className="material-symbols-outlined text-base">inventory_2</span>
                                            {item.quantity} kpl
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
                                            <span className="material-symbols-outlined text-base">location_on</span>
                                            {item.location}
                                        </span>
                                        {item.category && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
                                                <span className="material-symbols-outlined text-base">category</span>
                                                {item.category}
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
                                Ei tavaroita / No items yet
                            </p>
                        </div>
                    )}
                </div>
            </SplitLayout>
        </PageWrapper>
    );
}
