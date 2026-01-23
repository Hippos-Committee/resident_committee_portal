import { type ActionFunctionArgs, redirect } from "react-router";
import { getAuthenticatedUser } from "~/lib/auth.server";
import { getDatabase } from "~/db";
import { localeCookie } from "~/i18next.server";

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const language = formData.get("language") as string;
    const redirectTo = (formData.get("redirectTo") as string) || request.headers.get("Referer") || "/";

    if (!language) {
        return redirect(redirectTo);
    }

    // Update persistent user profile if logged in
    const authUser = await getAuthenticatedUser(request, getDatabase);
    if (authUser) {
        const db = getDatabase();
        // Only update if differnet to avoid unnecessary writes, though checking here is cheap
        if (authUser.primaryLanguage !== language) {
            await db.updateUser(authUser.userId, {
                primaryLanguage: language,
                // If the new primary is the same as secondary, clear secondary or swap?
                // For now, let's just update primary. If primary == secondary, it might look weird
                // but the user can fix it in profile. Or we can auto-swap?
                // Let's keep it simple: Just set primary.
            });
        }
    }

    // Update transient cookie
    return redirect(redirectTo, {
        headers: {
            "Set-Cookie": await localeCookie.serialize(language),
        },
    });
}
