import { createContext, useContext, type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useInfoReel } from "./info-reel-context";
import { useUser } from "./user-context";

export type Language = "fi" | "en" | "sv";

interface BilingualText {
    finnish: string;
    english: string;
}

interface LanguageContextValue {
    language: Language;
    setLanguage: (lang: Language) => void;
    getText: (text: BilingualText) => string | ReactNode;
    isInfoReel: boolean;
    primaryLanguage: string;
    secondaryLanguage: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const { isInfoReel } = useInfoReel();
    const { i18n } = useTranslation();
    const { user } = useUser();

    // Default to fi/en if user not loaded yet (though this provider is inside UserProvider)
    // or if user is somehow null (shouldn't be for guest context)
    const primaryLanguage = user?.primaryLanguage || "fi";
    const secondaryLanguage = user?.secondaryLanguage || "en";

    // Derived state from i18next
    const language = (i18n.language === "fi" ? "fi" : i18n.language === "sv" ? "sv" : "en") as Language;

    const setLanguage = (lang: Language) => {
        i18n.changeLanguage(lang);
    };

    const getText = (text: BilingualText): string | ReactNode => {
        // Legacy support helper
        if (isInfoReel) {
            return text.finnish;
        }
        if (language === "fi") return text.finnish;
        // Fallback to English for Swedish for now as we don't have trilingual content in DB
        if (language === "sv") return text.english;
        return text.english;
    };

    return (
        <LanguageContext.Provider value={{
            language,
            setLanguage,
            getText,
            isInfoReel,
            primaryLanguage,
            secondaryLanguage
        }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}
