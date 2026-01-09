# Resident Committee Portal

A modern, production-ready portal designed for resident committees and tenant associations. This platform streamlines communication between residents and their representatives, providing tools for involvement, transparency, and administrative management.

The objective of this project is to provide a generic, easily deployable template that any resident committee can use to manage their community engagement.

---

## Key Features

- **Resident Involvement**: Integrated forms for committee applications, event suggestions, and purchase requests.
- **Event Management**: Up-to-date view of upcoming community events (integrated with Google Calendar).
- **Transparency**: Easy access to meeting minutes, budgets, and public documents directly from Google Drive.
- **Social Integration**: Dynamic social media links managed via Google Sheets.
- **Info Reel Mode**: Automated "kiosk" mode that cycles through all pages—perfect for public displays.
- **Admin Dashboard**: A dedicated management interface for committee members to track and process submissions.

## Tech Stack

- **Framework**: [React Router 7](https://reactrouter.com/) (Vite)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/) based components
- **Integrations**: Google Cloud API (Sheets, Drive, Calendar)
- **Linting & Formatting**: [Biome](https://biomejs.dev/)
- **Runtime**: [Bun](https://bun.sh/) (Recommended)

## Getting Started

### Installation

Ensure you have [Bun](https://bun.sh/) installed:

```bash
bun install
```

### Development

Start the development server:

```bash
bun dev
```

The application will be available at `http://localhost:5173`.

### Production Build

Create an optimized production build:

```bash
bun run build
```

The application is container-ready and can be deployed using the included Dockerfile.

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

## Google Services Integration

This project integrates with Google Calendar, Drive, and Sheets to display dynamic content. To enable these features, you need to set up Google Cloud credentials.

### Setup Instructions

1.  **Duplicate the template**:
    ```bash
    cp .env.template .env
    ```

2.  **Get a Google API Key**:
    - Go to the [Google Cloud Console](https://console.cloud.google.com/).
    - Create a new project or select an existing one.
    - Enable the following APIs:
        - **Google Calendar API**
        - **Google Drive API**
        - **Google Sheets API**
    - Create credentials -> API Key.
    - Paste this key into `GOOGLE_API_KEY` in your `.env` file.

3.  **Get ID's**:
    - **Calendar ID**: Open Google Calendar settings -> Integrate calendar -> Calendar ID.
    
    - **Public Root Folder ID** (`GOOGLE_DRIVE_PUBLIC_ROOT_ID`): 
        - Create a root folder (e.g., "Committe Public Folder") in Google Drive.
        - At the root level, create a Google Sheet named `some` (for social media links).
        - Inside it, create folders for each year (e.g., "2026").
        - Inside a year folder (e.g. "2026"), create:
             - A Google Sheet named `budget` (import the template).
             - A folder named `minutes`.
        - **Share this folder with "Anyone with the link" (Viewer)**.
        - Get the ID from the URL and paste into `GOOGLE_DRIVE_PUBLIC_ROOT_ID`.

4.  **Create a Service Account** (for writing form submissions):
    - In Google Cloud Console -> IAM & Admin -> Service Accounts
    - Click "Create Service Account"
    - Give it a name (e.g., "Committee Portal")
    - Click "Create and Continue" (skip optional steps)
    - Click on the service account "..." -> Manage Keys -> Add Key -> Create New Key -> JSON
    - Download the JSON file
    - From the JSON, copy:
        - `client_email` -> `GOOGLE_SERVICE_ACCOUNT_EMAIL`
        - `private_key` -> `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (replace newlines with `\n`)

5.  **Create Submissions Sheet** (`GOOGLE_SUBMISSIONS_SHEET_ID`):
    - Create a new Google Sheet (e.g., "Form Submissions")
    - Add headers in row 1: `Timestamp | Type | Name | Email | Message | Status`
    - **Share this sheet with your service account email** (as Editor)
    - Get the Sheet ID from the URL and paste into `GOOGLE_SUBMISSIONS_SHEET_ID`
    
    **Status Values** (for the board/tracking):
    - `Uusi / New` - Just submitted, not yet reviewed
    - `Käsittelyssä / In Progress` - Being reviewed/worked on
    - `Hyväksytty / Approved` - Approved (for applications, event suggestions, purchases)
    - `Hylätty / Rejected` - Rejected/declined
    - `Valmis / Done` - Fully completed/resolved

6.  **Permissions Summary**:
    - Calendar: Make public (for event display)
    - Public folder: Share with "Anyone with the link" (Viewer)
    - Submissions sheet: Share with service account email (Editor)
 
---
 
## Performance & Caching
 
To minimize network overhead and ensure a smooth experience (especially in Info Reel mode), the portal implements two layers of caching:
 
### 1. Server-Side Caching
The backend caches data from Google APIs to avoid hitting rate limits and to speed up page loads.
- **Location**: `app/lib/cache.server.ts`
- **Duration**: Default is **3 hours**.
 
### 2. Client-Side Caching (TanStack Query)
The frontend uses [TanStack Query](https://tanstack.com/query/latest) to store fetched data in memory. This prevents redundant network requests during route transitions.
- **Location**: `app/lib/query-config.ts`
- **Default Stale Time**: **10 minutes**.
- **Behavior**: While data is fresh, navigating between pages is instantaneous and makes **zero network requests** to the backend.
 
#### Configuration
You can adjust how frequently the client refetches data by modifying `STALE_TIME` in `app/lib/query-config.ts`.
 
---
 
## Display Modes
 
### Info Reel (Kiosk Mode)

The application includes an "Info Reel" mode designed for public displays or kiosks. In this mode:
- The application automatically cycles through all main pages (`/`, `/events`, `/budget`, `/minutes`, `/social`) every 30 seconds.
- A visual progress bar at the bottom indicates the time remaining before the next transition.
- Decorative elements like "Open Link" buttons and the "Login" navigation item are hidden for a cleaner look.

To activate Info Reel mode, append `?view=infoReel` to any URL:
`http://localhost:5173/?view=infoReel`

---

Built with ❤️ using React Router.
