# TOAS Hippos Resident Committee Portal

Tämä on TOAS Hippos -asukkaille suunnattu palvelu, jonka kautta asukkaat voivat ottaa yhteyttä asukastoimikuntaan, hakea toimikunnan jäseneksi, ehdottaa tapahtumia tai pyytää hankintoja. Sivuston tavoitteena on lisätä asukastoimikunnan toiminnan läpinäkyvyyttä ja helpottaa osallistumista.

This is a portal for the residents of TOAS Hippos. Residents can use this platform to contact the tenant committee, apply for membership, suggest new events, or request purchases for common use. The goal of this site is to increase transparency and lower the barrier for resident involvement.

---

## Keskeiset Toiminnot / Key Features

- **Osallistu / Get Involved**: Integroidut lomakkeet asukastoimikuntaan hakemiseen, tapahtumaehdotuksiin ja hankintapyyntöihin.
- **Tapahtumat / Events**: Ajantasainen näkymä tulevista tapahtumista (integroitu Google Calendariin).
- **Avoimuus / Transparency**: Helppo pääsy asukastoimikunnan pöytäkirjoihin ja talousarvioon suoraan Google Drivesta.
- **Yhteydenotto / Contact**: Selkeä kanava kysymyksille ja palautteelle.
- **Ylläpito / Admin**: Toimikunnan jäsenille tarkoitettu hallintapaneeli hakemusten ja asioiden käsittelyyn.

## Teknologia / Tech Stack

- **Framework**: [React Router 7](https://reactrouter.com/) (Vite)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/) pohjaiset komponentit
- **Integrations**: Google Cloud API (Sheets, Drive, Calendar)
- **Linting & Formatting**: [Biome](https://biomejs.dev/)
- **Runtime**: [Bun](https://bun.sh/) (suositeltu)

## Aloitus / Getting Started

### Asennus / Installation

Varmista että sinulla on [Bun](https://bun.sh/) asennettuna:

```bash
bun install
```

### Kehitys / Development

Käynnistä kehityspalvelin:

```bash
bun dev
```

Sovellus on saatavilla osoitteessa `http://localhost:5173`.

### Tuotantoversio / Production

Rakenna optimoitu tuotantoversio:

```bash
bun run build
```

The application is container-ready and can be deployed using the included Dockerfile if needed.

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

Built with ❤️ using React Router.
