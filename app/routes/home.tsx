import type { Route } from "./+types/home";
import { PageWrapper, SplitLayout, QRPanel, ContentArea } from "~/components/layout/page-layout";
import { getAuthenticatedUser, getGuestContext } from "~/lib/auth.server";
import { getDatabase } from "~/db";
import { SITE_CONFIG } from "~/lib/config.server";
import { useTranslation } from "react-i18next";

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.siteConfig?.name || "Portal"} - Etusivu / Home` },
    { name: "description", content: data?.siteConfig?.description || "" },
  ];
}

interface InvolvementOption {
  id: string;
  icon: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const authUser = await getAuthenticatedUser(request, getDatabase);
  let languages;
  if (authUser) {
    languages = { primary: authUser.primaryLanguage, secondary: authUser.secondaryLanguage };
  } else {
    const ctx = await getGuestContext(() => getDatabase());
    languages = ctx.languages;
  }

  return {
    siteConfig: SITE_CONFIG,
    languages,
    options: [
      {
        id: "committee",
        icon: "diversity_3",
      },
      {
        id: "events",
        icon: "celebration",
      },
      {
        id: "purchases",
        icon: "shopping_cart",
      },
      {
        id: "questions",
        icon: "question_mark",
      },
    ] as InvolvementOption[],
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { options, languages } = loaderData;
  const { t, i18n } = useTranslation();

  // Determine which language to show as secondary (small text)
  // If current language matches the user's secondary language, show their primary instead to avoid duplicates
  // If they are the same (e.g. user set both to EN), it will just show EN twice, which is acceptable
  const secondaryDisplayLang = i18n.language === languages.secondary ? languages.primary : languages.secondary;

  // QR Panel only shown in info reel mode
  const RightContent = (
    <QRPanel
      qrPath="/contact"
      title={
        <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
          {t("home.contact.title")} <br />
          <span className="text-lg text-gray-400 font-bold">
            {t("home.contact.title", { lng: secondaryDisplayLang })}
          </span>
        </h2>
      }
    />
  );

  return (
    <PageWrapper>
      <SplitLayout
        right={RightContent}
        header={{
          primary: t("home.header"),
          secondary: t("home.header", { lng: secondaryDisplayLang })
        }}
      >
        <ContentArea className="space-y-4">
          {options.map((option) => (
            <a
              key={option.id}
              href={`/contact?type=${option.id}`}
              className="flex items-center gap-3 dark:bg-card transition-all cursor-pointer group hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-2xl p-2 -ml-2"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">
                  {option.icon}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight group-hover:text-primary transition-colors">
                  {t(`home.options.${option.id}.title`)}
                </h3>
                <p className="text-lg md:text-3xl font-medium text-gray-500 dark:text-gray-400">
                  {t(`home.options.${option.id}.title`, { lng: secondaryDisplayLang })}
                </p>
              </div>
              <span className="material-symbols-outlined text-2xl text-gray-300 dark:text-gray-600 group-hover:text-primary group-hover:translate-x-1 transition-all">
                arrow_forward
              </span>
            </a>
          ))}
        </ContentArea>
      </SplitLayout>
    </PageWrapper>
  );
}

