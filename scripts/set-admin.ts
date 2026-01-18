import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL as string);
const adminEmail = process.env.ADMIN_EMAIL as string;

async function main() {
    const email = adminEmail;

    // Find the user
    const users = await sql`SELECT id, email, role, role_id FROM users WHERE email = ${email.toLowerCase()}`;
    console.log("User found:", users);

    // Find the Admin role
    const adminRoles = await sql`SELECT id, name FROM roles WHERE name = 'Admin'`;
    console.log("Admin role found:", adminRoles);

    if (users.length === 0) {
        console.log("User not found, creating...");
        const newUser = await sql`INSERT INTO users (email, name, role) VALUES (${email.toLowerCase()}, 'Super Admin', 'admin') RETURNING *`;
        console.log("Created user:", newUser);
    }

    if (adminRoles.length > 0) {
        // Update user to have Admin role
        const result = await sql`UPDATE users SET role_id = ${adminRoles[0].id}, role = 'admin' WHERE email = ${email.toLowerCase()} RETURNING *`;
        console.log("Updated user with Admin role:", result);
    } else {
        console.log("Admin role doesn't exist. Available roles:");
        const allRoles = await sql`SELECT id, name FROM roles`;
        console.log(allRoles);

        // Just set legacy role to admin
        const result = await sql`UPDATE users SET role = 'admin' WHERE email = ${email.toLowerCase()} RETURNING *`;
        console.log("Set legacy admin role:", result);
    }
}

main().catch(console.error);
