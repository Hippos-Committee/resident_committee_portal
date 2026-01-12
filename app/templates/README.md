# Portal Templates

This directory contains template files and instructions for maintaining the data used by the Resident Committee Portal application.

## Folder Structure

The application now reads from a single **Root Folder** in Google Drive defined by `GOOGLE_DRIVE_ROOT_ID`.

**Expected Structure:**
```
ROOT_FOLDER/
├── 2026/
│   ├── budget (Google Sheet)
│   └── minutes/ (Folder)
│       ├── 2026-01-05_Meeting.pdf
│       └── ...
├── 2027/
│   └── ...
```

## 1. Budget (`budget.csv`)

This file is a template for the yearly budget using a **transaction ledger** format.

### Instructions:
1.  Inside the current year's folder (e.g., `2026`), create a **New Google Sheet** named `budget`.
2.  **Import** (`File > Import`) the `budget.csv` file into this sheet.
3.  **Add transactions** with these columns:
    *   **Column A (Receipt)**: Receipt number (1, 2, 3...)
    *   **Column B (Date)**: Transaction date (DD.MM.YYYY)
    *   **Column C (Description)**: What was purchased/received
    *   **Column D (Person)**: Who made the purchase or income source
    *   **Column E (Amount)**: Amount in euros (**positive** = income, **negative** = expense)
    *   **Column F (Category)**: Category (e.g., "Tulot", "Tapahtumat", "Hankinnat")
4.  The application **automatically calculates** remaining budget and totals from the transactions.
5.  **Optional**: Below the `---` marker row, you can add your own SUM formulas to verify totals.

> **Note**: The app stops reading at rows starting with `---`, so anything below that marker is ignored.


## 2. Minutes (`minutes_convention.md`)

Refer to `minutes_convention.md` for details on how to name your PDF files inside the `minutes` folder of the current year.

## 3. Social Media (`some.csv`)

This file is a template for social media channels displayed on the "Social" page.

### Instructions:
1.  In the **Root Folder** (not inside a year folder), create a **New Google Sheet** named `some`.
2.  **Import** (`File > Import`) the `some.csv` file into this sheet.
3.  **Fill in the values**:
    *   **Column A (name)**: Display name (e.g., "Telegram", "Instagram")
    *   **Column B (icon)**: Material symbol name (e.g., "send", "photo_camera")
    *   **Column C (url)**: Full URL to the social media page
    *   **Column D (color)**: Tailwind CSS background class (e.g., "bg-blue-500")
4.  The application will automatically find this file (`some`) in the root folder.

### Common Icon Names
| Platform | Icon Name |
|----------|-----------|
| Telegram | `send` |
| Instagram | `photo_camera` |
| Facebook | `thumb_up` |
| X/Twitter | `alternate_email` |
| TikTok | `music_note` |
| YouTube | `play_circle` |
| LinkedIn | `work` |
| Discord | `forum` |
| WhatsApp | `chat` |
| Email | `mail` |
| Website | `language` |
| Generic | `link` |

> **Tip**: Browse all icons at [Material Symbols](https://fonts.google.com/icons)

## 4. Inventory (`inventory.csv`)

This file is a template for tracking committee inventory items displayed on the "Tavaraluettelo" page.

### Instructions:
1.  Inside the current year's folder (e.g., `2026`), create a **New Google Sheet** named `inventory`.
2.  **Import** (`File > Import`) the `inventory.csv` file into this sheet.
3.  **Fill in the values**:
    *   **Column A (Item Name)**: Name of the item (e.g., "Projector", "Sound System")
    *   **Column B (Quantity)**: Number of items
    *   **Column C (Location)**: Where it's stored (e.g., "Storage Room", "Office")
    *   **Column D (Category)**: Category (e.g., "Electronics", "Furniture", "Kitchen")
    *   **Column E (Description)**: Brief description of the item
    *   **Column F (Value)**: Estimated value in euros (used for sorting top items)
4.  The application will automatically find this file (`inventory`) inside the year folder.

> **Note**: The public page shows only the **3 most valuable items** (sorted by Column F). A QR code/link provides access to the full inventory spreadsheet.
