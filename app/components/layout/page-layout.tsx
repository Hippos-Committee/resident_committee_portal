import { Link } from "react-router";
import { DynamicQR } from "~/components/dynamic-qr";
import { cn } from "~/lib/utils";

interface PageWrapperProps {
    children: React.ReactNode;
    className?: string;
}

export function PageWrapper({ children, className }: PageWrapperProps) {
    return (
        <div className={cn("font-sans text-[#111418] dark:text-gray-100 min-h-screen flex flex-col overflow-x-hidden selection:bg-primary/30", className)}>
            <div className="flex-1 flex flex-col items-center justify-start">
                {children}
            </div>
        </div>
    );
}

interface PageHeaderProps {
    finnish: string;
    english: string;
    className?: string;
}

export function PageHeader({ finnish, english, className }: PageHeaderProps) {
    return (
        <h1 className={cn("text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-8", className)}>
            <span className="text-gray-900 dark:text-white">{finnish}</span>
            <br />
            <span className="text-primary">{english}</span>
        </h1>
    );
}

interface SplitLayoutProps {
    children: React.ReactNode;
    right: React.ReactNode;
    header?: {
        finnish: string;
        english: string;
    };
    className?: string;
}

export function SplitLayout({ children, right, header, className }: SplitLayoutProps) {
    return (
        <div className={cn("w-full max-w-[1200px] overflow-hidden flex flex-col lg:flex-row h-auto lg:min-h-[600px]", className)}>
            <div className="lg:w-7/12 flex flex-col p-8 lg:p-12 relative max-h-[calc(100vh-20rem)]">
                {header && (
                    <PageHeader finnish={header.finnish} english={header.english} />
                )}
                {children}
            </div>

            {/* Right Side / QR Panel Area */}
            {right}
        </div>
    );
}

interface QRPanelProps {
    qrPath?: string;
    qrUrl?: string; // For external links
    title?: React.ReactNode;
    description?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

export function QRPanel({ qrPath, qrUrl, title, description, children, className }: QRPanelProps) {
    const path = qrPath || qrUrl || "/";
    const isExternal = !!qrUrl;

    return (
        <div className={cn("lg:w-5/12 p-8 lg:p-12 flex flex-col items-center justify-start text-center", className)}>
            <div className="flex flex-col items-center max-w-sm mx-auto w-full">
                {title && (
                    <div className="mb-6">
                        {title}
                    </div>
                )}

                <div className="mb-0 p-4 bg-white rounded-3xl dark:bg-white/5 w-full max-w-full mx-auto aspect-square min-w-[100px]">
                    <DynamicQR path={path} className="w-full h-full" />
                </div>

                {description && (
                    <div className="mt-6 mb-4">
                        {description}
                    </div>
                )}

                {children}

                {isExternal ? (
                    <a
                        href={qrUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex mt-8 items-center gap-2 text-sm font-bold text-gray-400 bg-gray-50 dark:bg-gray-800 px-5 py-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">
                            open_in_new
                        </span>
                        <span>Avaa linkki / Open Link</span>
                    </a>
                ) : (
                    <Link
                        to={path}
                        className="inline-flex mt-8 items-center gap-2 text-sm font-bold text-gray-400 bg-gray-50 dark:bg-gray-800 px-5 py-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">
                            open_in_new
                        </span>
                        <span>Avaa linkki / Open Link</span>
                    </Link>
                )}
            </div>
        </div>
    );
}
