import type { Route } from "./+types/budget";
import { PageWrapper, SplitLayout, QRPanel, ActionButton } from "~/components/layout/page-layout";
import { getBudgetInfo } from "~/lib/google.server";
import { queryClient } from "~/lib/query-client";
import { queryKeys, STALE_TIME } from "~/lib/query-config";

export function meta() {
    return [
        { title: "Toas Hippos - Budjetti / Budget" },
        { name: "description", content: "Toimikunnan budjetti / Tenant Committee Budget" },
    ];
}

export async function loader({ }: Route.LoaderArgs) {
    // Use ensureQueryData for client-side caching
    const budgetData = await queryClient.ensureQueryData({
        queryKey: queryKeys.budget,
        queryFn: getBudgetInfo,
        staleTime: STALE_TIME,
    });

    return {
        remainingBudget: budgetData?.remaining || "--- €",
        totalBudget: budgetData?.total || "--- €",
        lastUpdated: budgetData?.lastUpdated || "",
        detailsUrl: budgetData?.detailsUrl || "#"
    };
}

export default function Budget({ loaderData }: Route.ComponentProps) {
    const { remainingBudget, totalBudget, lastUpdated, detailsUrl } = loaderData;

    // QR Panel only shown in info reel mode
    const RightContent = (
        <QRPanel
            qrUrl={detailsUrl}
            title={
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    Katso erittely <br />
                    <span className="text-lg text-gray-400 font-bold">See Breakdown</span>
                </h2>
            }
        />
    );

    // Action button shown below content in regular mode
    const FooterContent = (
        <ActionButton
            href={detailsUrl}
            icon="table_chart"
            labelFi="Katso erittely"
            labelEn="See Breakdown"
            external={true}
        />
    );

    return (
        <PageWrapper>
            <SplitLayout
                right={RightContent}
                footer={FooterContent}
                header={{ finnish: "Budjetti", english: "Budget" }}
            >
                <div className="space-y-8">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Jäljellä oleva budjetti / Remaining Budget</p>
                        <p className="text-5xl lg:text-7xl font-black text-gray-900 dark:text-white tracking-tighter">{remainingBudget}</p>
                    </div>

                    <div>
                        <p className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Kokonaisbudjetti / Total Budget</p>
                        <p className="text-2xl lg:text-3xl font-bold text-gray-700 dark:text-gray-300">{totalBudget}</p>
                    </div>

                    <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Päivitetty / Updated: <span className="font-bold text-gray-900 dark:text-white">{lastUpdated}</span>
                        </p>
                    </div>
                </div>
            </SplitLayout>
        </PageWrapper>
    );
}

