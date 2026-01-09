import type { Route } from "./+types/minutes";
import { PageWrapper, SplitLayout, QRPanel } from "~/components/layout/page-layout";
import { getMinutesByYear, type MinutesByYear } from "~/lib/google.server";
import { queryClient } from "~/lib/query-client";
import { queryKeys, STALE_TIME } from "~/lib/query-config";

export function meta() {
    return [
        { title: "Toas Hippos - Pöytäkirjat / Minutes" },
        { name: "description", content: "Toimikunnan kokouspöytäkirjat / Tenant Committee Meeting Minutes" },
    ];
}

export async function loader({ }: Route.LoaderArgs) {
    // Use ensureQueryData for client-side caching
    const minutesByYear = await queryClient.ensureQueryData({
        queryKey: queryKeys.minutes,
        queryFn: getMinutesByYear,
        staleTime: STALE_TIME,
    });

    // Get the archive URL from the most recent year with files
    const archiveUrl = minutesByYear.find(y => y.files.length > 0)?.folderUrl || "#";

    return {
        minutesByYear,
        archiveUrl
    };
}

export default function Minutes({ loaderData }: Route.ComponentProps) {
    const { minutesByYear, archiveUrl } = loaderData;

    // QR Panel only shown in info reel mode
    const RightContent = (
        <QRPanel
            qrUrl={archiveUrl}
            title={
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    Kaikki pöytäkirjat <br />
                    <span className="text-3xl text-gray-400 font-bold">All Minutes</span>
                </h2>
            }
        />
    );

    const currentYear = new Date().getFullYear().toString();

    return (
        <PageWrapper>
            <SplitLayout
                right={RightContent}
                header={{ finnish: "Pöytäkirjat", english: "Minutes" }}
            >
                <div className="space-y-8">
                    {minutesByYear.map((yearGroup: MinutesByYear) => (
                        <div key={yearGroup.year} className="relative">
                            {/* Year header - same style as month headers in events */}
                            <div className="bg-primary -mx-8 mb-6 px-8 py-4 lg:-mx-12 lg:mb-6 lg:px-12 flex items-center justify-between text-white">
                                <p className="text-xl font-bold leading-none uppercase tracking-widest">
                                    {yearGroup.year}
                                </p>
                                {yearGroup.year === currentYear && (
                                    <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                                        Tämä vuosi / This Year
                                    </span>
                                )}
                            </div>

                            {/* Files list or placeholder */}
                            {yearGroup.files.length === 0 ? (
                                <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 text-center">
                                    <p className="text-gray-400 font-medium">
                                        Ei vielä pöytäkirjoja / No minutes yet
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {yearGroup.files.map((file) => (
                                        <a
                                            key={file.id}
                                            href={file.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block group"
                                        >
                                            <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors truncate">
                                                        {file.name}
                                                    </h3>
                                                </div>
                                                <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors shrink-0 ml-4">
                                                    description
                                                </span>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {minutesByYear.length === 0 && (
                        <div className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest">
                            Ei pöytäkirjoja / No minutes
                        </div>
                    )}
                </div>
            </SplitLayout>
        </PageWrapper>
    );
}

