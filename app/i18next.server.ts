import Backend from "i18next-fs-backend";
import { resolve } from "node:path";
import { RemixI18Next } from "remix-i18next/server";
import i18n from "./i18n"; // your i18n configuration file
import { createCookie } from "react-router";

// Custom cookie implementation to handle raw strings written by client-side i18next
export const localeCookie = {
    name: "locale",
    isSigned: false,
    parse: async (cookieHeader: string | null) => {
        if (!cookieHeader) return null;
        // Match 'locale=value' manually to handle raw strings
        const match = cookieHeader.match(/(?:^|;)\s*locale=([^;]+)/);
        return match ? match[1] : null;
    },
    serialize: async (value: string) => {
        // Serialize simple key=value
        return `locale=${value}; Path=/; SameSite=Lax`;
    },
};

const i18next = new RemixI18Next({
    detection: {
        supportedLanguages: i18n.supportedLngs,
        fallbackLanguage: i18n.fallbackLng,
        order: ["cookie", "header"],
        cookie: localeCookie,
    },
    // This is the configuration for i18next meant for the Server-side only
    i18next: {
        ...i18n,
        backend: {
            loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json"),
        },
    },
    // The i18next plugins you want RemixI18next to use for `i18n.getFixedT` inside loaders and actions.
    plugins: [Backend],
});

export default i18next;
