import { Link } from "react-router";
import type { Route } from "./+types/minutes";
import { PageWrapper, SplitLayout, QRPanel, PageHeader } from "~/components/layout/page-layout";

export function meta() {
    return [
        { title: "Toas Hippos - Pöytäkirjat / Minutes" },
        { name: "description", content: "Toimikunnan kokouspöytäkirjat / Tenant Committee Meeting Minutes" },
    ];
}

import { getMinutesFiles } from "~/lib/google.server";

interface MinuteItem {
    id: string;
    date: string;
    title: string;
    url: string;
}

export async function loader({ }: Route.LoaderArgs) {
    const { files: minutesFiles, folderUrl } = await getMinutesFiles();

    const minutes = Array.isArray(minutesFiles) ? minutesFiles.map((file: any) => ({
        id: file.id,
        date: new Date(file.createdTime).toLocaleDateString("fi-FI"),
        title: file.name.replace(".pdf", ""), // Clean up extensions if present
        url: file.webViewLink
    })) : [];

    return {
        minutes,
        archiveUrl: folderUrl
    };
}

export default function Minutes({ loaderData }: Route.ComponentProps) {
    const { minutes, archiveUrl } = loaderData;

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

    return (
        <PageWrapper>
            <SplitLayout
                right={RightContent}
                header={{ finnish: "Pöytäkirjat", english: "Minutes" }}
            >
                <div className="space-y-4">
                    {minutes.map((item: MinuteItem) => (
                        <a key={item.id} href={item.url} className="block group">
                            <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div>
                                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">{item.date}</p>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">{item.title}</h3>
                                </div>
                                <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">description</span>
                            </div>
                        </a>
                    ))}
                </div>
            </SplitLayout>
        </PageWrapper>
    );
}
