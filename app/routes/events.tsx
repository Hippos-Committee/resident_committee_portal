import type { Route } from "./+types/events";
import { PageWrapper, SplitLayout, QRPanel, ActionButton } from "~/components/layout/page-layout";
import { getCalendarEvents, getCalendarUrl } from "~/lib/google.server";
import { queryClient } from "~/lib/query-client";
import { queryKeys, STALE_TIME } from "~/lib/query-config";
import { SITE_CONFIG } from "~/lib/config.server";

export function meta({ data }: Route.MetaArgs) {
	return [
		{ title: `${data?.siteConfig?.name || "Portal"} - Tapahtumat / Events` },
		{ name: "description", content: "Tulevat tapahtumat / Upcoming events" },
	];
}

interface Event {
    id: string;
    date: string;
    day: string;
    title: string;
    time: string;
    location: string;
    type: "meeting" | "social" | "private";
}

interface GroupedMonth {
    monthName: string;
    events: Event[];
}

export async function loader({ }: Route.LoaderArgs) {
    // Use ensureQueryData for client-side caching
    // Returns cached data if fresh, fetches if stale
    const [calendarItems, calendarUrl] = await Promise.all([
        queryClient.ensureQueryData({
            queryKey: queryKeys.calendar,
            queryFn: getCalendarEvents,
            staleTime: STALE_TIME,
        }),
        queryClient.ensureQueryData({
            queryKey: queryKeys.calendarUrl,
            queryFn: getCalendarUrl,
            staleTime: STALE_TIME,
        }),
    ]);

    if (!calendarItems.length) {
        return {
            groupedMonths: [],
            calendarUrl
        };
    }

    const groupedMap = new Map<string, Event[]>();

    calendarItems.forEach((item: any) => {
        const startDate = new Date(item.start?.dateTime || item.start?.date || new Date());

        const monthNameFin = startDate.toLocaleDateString("fi-FI", { month: "long" });
        const monthNameEng = startDate.toLocaleDateString("en-GB", { month: "long" });
        const year = startDate.getFullYear();

        const displayMonth = `${monthNameFin.charAt(0).toUpperCase() + monthNameFin.slice(1)} / ${monthNameEng.charAt(0).toUpperCase() + monthNameEng.slice(1)} ${year}`;

        const isAllDay = !item.start?.dateTime;
        const summary = item.summary || "Untitled Event";

        const event: Event = {
            id: item.id,
            date: startDate.getDate().toString(),
            day: startDate.toLocaleDateString("en-GB", { weekday: "short" }) + " / " + startDate.toLocaleDateString("fi-FI", { weekday: "short" }),
            title: summary,
            time: isAllDay ? "Koko päivä / All Day" : startDate.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" }),
            location: item.location || "",
            type: (item.description?.includes("#meeting") || summary.toLowerCase().includes("kokous")) ? "meeting" : "social",
        };

        if (!groupedMap.has(displayMonth)) {
            groupedMap.set(displayMonth, []);
        }
        groupedMap.get(displayMonth)?.push(event);
    });

    const groupedMonths: GroupedMonth[] = Array.from(groupedMap.entries()).map(([monthName, events]) => ({
        monthName,
        events
    }));

    return {
        siteConfig: SITE_CONFIG,
        groupedMonths,
        calendarUrl
    };
}

export default function Events({ loaderData }: Route.ComponentProps) {
    const { groupedMonths, calendarUrl } = loaderData;

    // QR Panel only shown in info reel mode
    const RightContent = (
        <QRPanel
            qrUrl={calendarUrl || undefined}
            title={
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    Avaa kalenteri <br />
                    <span className="text-lg text-gray-400 font-bold">Open Calendar</span>
                </h2>
            }
        />
    );

    // Action button shown below content in regular mode
    const FooterContent = calendarUrl ? (
        <ActionButton
            href={calendarUrl}
            icon="calendar_month"
            labelFi="Avaa kalenteri"
            labelEn="Open Calendar"
            external={true}
        />
    ) : null;

    return (
        <PageWrapper>
            <SplitLayout
                right={RightContent}
                footer={FooterContent}
                header={{ finnish: "Tapahtumat", english: "Events" }}
            >
                <div>
                    {!groupedMonths.length ? (
                        <div className="bg-primary -mx-8 mb-8 px-8 py-4 lg:-mx-12 lg:mb-8 lg:px-12 flex items-center justify-end text-white">
                            <p className="text-xl font-bold leading-none uppercase tracking-widest">
                                Tulevat / Upcoming
                            </p>
                        </div>
                    ) : null}

                    <div className="space-y-12">
                        {groupedMonths.map((group) => (
                            <div key={group.monthName} className="relative">
                                <div className="bg-primary -mx-8 mb-8 px-8 py-4 lg:-mx-12 lg:mb-8 lg:px-12 flex items-center justify-end text-white sticky top-0 z-10">
                                    <p className="text-xl font-bold leading-none uppercase tracking-widest">
                                        {group.monthName}
                                    </p>
                                </div>

                                <div className="flex-1 relative flex flex-col">
                                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {group.events.map((event: Event) => (
                                            <li
                                                key={event.id}
                                                className={`flex items-center p-6 hover:bg-white dark:hover:bg-gray-800/50 transition-colors ${event.type === "meeting" ? "bg-red-50/50 dark:bg-red-900/10" : ""} ${event.type === "private" ? "opacity-60" : ""}`}
                                            >
                                                <div
                                                    className={`w-20 flex flex-col items-center justify-center shrink-0 leading-none mr-6 ${event.type === "meeting" ? "text-primary dark:text-red-400" : event.type === "private" ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"}`}
                                                >
                                                    <span className="text-4xl font-black tracking-tighter">{event.date}</span>
                                                    <span className="text-xs font-bold uppercase mt-1 tracking-wider">
                                                        {event.day}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3
                                                        className={`text-xl font-black uppercase tracking-tight truncate ${event.type === "private" ? "text-gray-500 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}
                                                    >
                                                        {event.title}
                                                    </h3>
                                                    <div
                                                        className={`flex items-center gap-4 text-sm font-bold uppercase tracking-wide mt-1.5 ${event.type === "private" ? "text-gray-400 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"}`}
                                                    >
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-[18px]">
                                                                schedule
                                                            </span>{" "}
                                                            {event.time}
                                                        </span>
                                                        {event.location && (
                                                            <span className="flex items-center gap-1.5 truncate">
                                                                <span className="material-symbols-outlined text-[18px]">
                                                                    location_on
                                                                </span>{" "}
                                                                {event.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>

                    {groupedMonths.length === 0 && (
                        <div className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest">
                            Ei tulevia tapahtumia / No upcoming events
                        </div>
                    )}
                </div>
            </SplitLayout>
        </PageWrapper>
    );
}

