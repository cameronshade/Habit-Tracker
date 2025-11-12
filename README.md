# Progress Tracker

A personal habit and progress tracking application with a GitHub-style contribution graph visualization.

## Features

- **GitHub-Style Visualization**: Track your habits with an intuitive contribution graph interface
- **Local Data Storage**: All your personal data stays on your machine - save and load from local JSON files
- **Habit Management**: Add, remove, and track multiple habits
- **Progress Analytics**: See how many days you've completed for each habit
- **Date Tracking**: Optional end dates for completed or discontinued habits
- **Responsive Design**: Works beautifully on desktop and mobile devices
- **Dark Mode**: Automatic dark mode support

## Getting Started

### Development

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Production Build

Build the application for production:

```bash
npm run build
npm start
```

### Deploy to GitHub Pages

1. Update `next.config.ts` with your repository name (if using a project page)
2. Install the deployment package:
```bash
npm install --save-dev @next/bundle-analyzer
```
3. Build and export:
```bash
npm run build
```
4. Deploy the `.next` directory or use a static export

## How to Use

1. **Add a Habit**: Enter the habit name and optionally a date when you stopped/plan to stop
2. **Track Progress**: Click on any day square to mark it as complete (green) or incomplete (gray)
3. **Save Your Data**: Click "Save Data" to download your habits as a JSON file to your desktop
4. **Load Your Data**: Click "Load Data" to restore your habits from a saved JSON file
5. **Reset or Remove**: Use the reset button to clear all completions or trash button to remove a habit

## Privacy

This application stores NO data in the cloud or repository. All your habit data is:
- Stored locally in your browser's memory during your session
- Only saved when you explicitly export it to a file
- Never committed to the Git repository (`habit-tracker-data.json` is gitignored)

Perfect for public hosting while keeping your personal information private!

## Technologies

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Lucide Icons** - Beautiful icons

## License

MIT
