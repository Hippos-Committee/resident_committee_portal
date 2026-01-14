
import { getDatabase } from '../app/db/index';

async function verify() {
    console.log('Verifying migration...');
    const db = getDatabase();

    const transactions = await db.getTransactionsByYear(2025);
    console.log(`Found ${transactions.length} transactions for 2025.`);

    if (transactions.length > 0) {
        console.log('Sample transaction:');
        console.log(transactions[0]);

        let totalIncome = 0;
        let totalExpense = 0;

        for (const t of transactions) {
            const amount = parseFloat(t.amount);
            if (t.type === 'income') totalIncome += amount;
            else if (t.type === 'expense') totalExpense += amount;
        }

        console.log(`Total Income: ${totalIncome.toFixed(2)}`);
        console.log(`Total Expense: ${totalExpense.toFixed(2)}`);
    }

    process.exit(0);
}

verify().catch(console.error);
