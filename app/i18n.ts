export const config = {
    // This is the list of languages your application supports
    supportedLngs: ["en", "fi", "sv"],
    // This is the language you want to use in case
    // if the user language is not in the supportedLngs
    fallbackLng: "en",
    // The default namespace of i18next is "translation", but you can customize it here
    defaultNS: "common",
    // Disabling suspense is recommended when using server-side rendering
    react: { useSuspense: false },
};

export default config;
