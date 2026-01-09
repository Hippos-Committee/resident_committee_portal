import { useInfoReel } from "~/contexts/info-reel-context";

export function InfoReelProgressBar() {
    const { isInfoReel, progress } = useInfoReel();

    if (!isInfoReel) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[100] h-2 bg-gray-200 dark:bg-gray-800">
            <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
}
