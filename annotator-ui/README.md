# Chat Log Annotation UI

This Next.js application is for a human study on identifying deception and non-adherence in patient-bot chat logs.

## Core Features

-   **Guided Workflow**: Annotators classify logs as `truthful/deceitful` and `adhering/non-adhering`, selecting from predefined indicators to justify their choices.
-   **A/B Testing**: Can be configured to show AI-generated summaries to certain user groups for comparative analysis.
-   **Timed & Exportable**: Annotations are timed, and the final results can be downloaded as a `.jsonl` file.

## Project Structure

-   `src/app/page.tsx`: The main application component containing all UI and logic.
-   `public/data/`: Holds the raw chat logs and summaries, organized by category.
-   `scripts/prepare-data.mjs`: A script that scans the `data` directory to generate `public/manifest.json`, which the app uses to load logs.

## Getting Started

1.  **Install Dependencies & Prepare Data**:
    ```bash
    npm install
    node scripts/prepare-data.mjs
    ```

2.  **Run the Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to start.

## Annotation Workflow

1.  **Setup**: Read the guidelines, then enter your Annotator ID and select a group.
2.  **Annotate**: For each log, start the timer, classify the conversation, select all relevant indicators, and submit.
3.  **Download**: When finished, download your annotations as a `.jsonl` file.

## Annotation Data Format

The output `.jsonl` file contains one JSON object per line, matching this structure:

```typescript
interface Annotation {
  logId: string;
  annotatorId: number;
  annotatorGroup: 'group1' | 'group2';
  condition: 'log-only' | 'log-with-summary';
  deception: 'truthful' | 'deceitful';
  adherence: 'adhering' | 'non-adhering';
  indicators: string[]; // e.g., ['Inconsistency']
  timeToAnnotateInSeconds: number;
}
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
