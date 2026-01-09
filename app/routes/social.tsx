import { useState } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/social";
import { PageWrapper, SplitLayout, QRPanel, PageHeader } from "~/components/layout/page-layout";
import { getSocialChannels, type SocialChannel } from "~/lib/google.server";

export function meta() {
    return [
        { title: "Toas Hippos - Some / Social" },
        { name: "description", content: "Seuraa meitä somessa / Follow us on social media" },
    ];
}

export async function loader({ }: Route.LoaderArgs) {
    const channels = await getSocialChannels();
    return { channels };
}

export default function Social({ loaderData }: Route.ComponentProps) {
    const { channels } = loaderData;
    const [activeChannelId, setActiveChannelId] = useState<string>(channels[0].id);

    const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];

    const RightContent = (
        <QRPanel
            qrUrl={activeChannel.url}
            key={activeChannel.id}
            title={
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    Avaa kanava <br />
                    <span className="text-lg text-gray-400 font-bold">Open Channel</span>
                </h2>
            }
        />
    );

    return (
        <PageWrapper>
            <SplitLayout
                right={RightContent}
                header={{ finnish: "Sosiaalinen Media", english: "Social Media" }}
            >
                <div className="space-y-4">
                    {channels.map((channel) => (
                        <button
                            key={channel.id}
                            onClick={() => setActiveChannelId(channel.id)}
                            className={cn(
                                "w-full flex items-center gap-6 p-4 rounded-2xl border transition-all text-left group outline-none focus:ring-2 focus:ring-primary/20",
                                activeChannelId === channel.id
                                    ? "bg-white dark:bg-card border-primary dark:border-primary shadow-md scale-[1.02]"
                                    : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            )}
                        >
                            <div
                                className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 transition-transform group-hover:scale-110",
                                    channel.color
                                )}
                            >
                                <span className="material-symbols-outlined text-2xl">
                                    {channel.icon}
                                </span>
                            </div>
                            <div>
                                <h3 className={cn(
                                    "text-lg font-bold leading-tight transition-colors",
                                    activeChannelId === channel.id ? "text-primary" : "text-gray-900 dark:text-white"
                                )}>
                                    {channel.name}
                                </h3>
                            </div>
                            {activeChannelId === channel.id && (
                                <span className="material-symbols-outlined text-primary ml-auto animate-in fade-in slide-in-from-left-2">
                                    chevron_right
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </SplitLayout>
        </PageWrapper>
    );
}
