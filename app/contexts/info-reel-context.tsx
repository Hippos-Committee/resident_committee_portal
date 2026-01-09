import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

const REEL_ROUTES = ["/", "/events", "/budget", "/minutes", "/social"];
const REEL_DURATION = 30000; // 30 seconds per page

interface InfoReelContextValue {
    isInfoReel: boolean;
    progress: number; // 0-100, where 100 = just started, 0 = about to transition
}

const InfoReelContext = createContext<InfoReelContextValue>({
    isInfoReel: false,
    progress: 100,
});

export function useInfoReel() {
    return useContext(InfoReelContext);
}

export function InfoReelProvider({ children }: { children: ReactNode }) {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();

    const isInfoReel = searchParams.get("view") === "infoReel";
    const [progress, setProgress] = useState(100);

    const getCurrentRouteIndex = useCallback(() => {
        return REEL_ROUTES.indexOf(location.pathname);
    }, [location.pathname]);

    const navigateToNextRoute = useCallback(() => {
        const currentIndex = getCurrentRouteIndex();
        const nextIndex = (currentIndex + 1) % REEL_ROUTES.length;
        navigate(`${REEL_ROUTES[nextIndex]}?view=infoReel`);
    }, [getCurrentRouteIndex, navigate]);

    useEffect(() => {
        if (!isInfoReel) {
            setProgress(100);
            return;
        }

        // Reset progress when route changes
        setProgress(100);

        const startTime = Date.now();
        const intervalId = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / REEL_DURATION) * 100);
            setProgress(remaining);

            if (remaining <= 0) {
                navigateToNextRoute();
            }
        }, 50); // Update every 50ms for smooth animation

        return () => clearInterval(intervalId);
    }, [isInfoReel, location.pathname, navigateToNextRoute]);

    return (
        <InfoReelContext.Provider value={{ isInfoReel, progress }}>
            {children}
        </InfoReelContext.Provider>
    );
}
