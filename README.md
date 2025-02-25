# Frontend: Recipe Recommender (React + Prompt-Engineered UI)

## Overview

This repository holds the React-based frontend for the AI Recipe Recommender. It is prompt-engineered to minimize manual coding, featuring both desktop and mobile builds, dynamic recipe searching, GPT-based ingredient remixes, and integrated DALL·E cover images.

## Features

- **Desktop & Mobile Builds**: Uses user-agent detection (or separate domains) to serve the appropriate bundle.
- **Autocomplete**: Debounced search input hitting the backend’s `/autocomplete` endpoint.
- **Recipe & Info Tabs**: Displays recipe steps, macros, ingredients, and optionally GPT-generated covers.
- **AI Remix Workflow**: Allows users to deselect certain ingredients, calls the backend for a GPT-based recipe remix, and displays new steps/macros.
- **History & Recommendations**: Caches previously searched or remixed recipes; shows GPT-refined recommendations.

## Requirements

- Node.js 14+
- A running instance of the backend, typically at `https://recipe-recommender-backend.onrender.com` or `localhost`.

## Setup

1. Clone this repository.
2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm start
```

4. Build for production:

```bash
npm run build
```

5. Serve the build output (e.g., via `serve -s build`).

## Usage

1. Search for a recipe name (3+ chars) to see autocomplete suggestions.
2. Select a suggestion to load metadata, steps, macros, and recommended recipes.
3. Switch to the **Info** tab for macros, prep time, and ingredient lists.
4. Click the **AI Remix** button to deselect missing ingredients and generate a GPT-based variation.
