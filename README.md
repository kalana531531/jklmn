# WindSight – UK Wind Generation Forecast Monitor

WindSight is a web-based application designed to help UK electricity teams monitor wind generation forecasts, review forecast accuracy, and compare forecast data with actual wind generation.

The application uses React and TypeScript for the frontend and Python with FastAPI for the backend. It integrates with the Elexon BMRS API to retrieve UK electricity market wind generation data.

## Features

- **Wind generation monitoring:** View UK wind generation forecast information.
- **Historical forecast accuracy:** Review historical forecast accuracy over selected date ranges.
- **Forecast and actual comparison:** Analyse forecast performance against actual generation data.
- **Interactive dashboard:** Access wind generation information through a React-based web interface.
- **API integration:** Retrieve data from the Elexon BMRS API.

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- pnpm

### Backend
- Python
- FastAPI
- Uvicorn
- HTTPX

### Development and Deployment
- Docker
- Docker Compose
- Git and GitHub
- Vercel

### Data Source
- Elexon BMRS API – UK electricity market data.

## Project Structure

```text
WindPower/
├── .dockerignore                      # Excludes repository and generated files from Docker build contexts.
├── .gitignore                         # Lists repository-level files Git should ignore.
├── compose.yaml                       # Defines the frontend and backend Docker services and their ports.
├── front/
│   ├── .dockerignore                  # Excludes frontend dependencies and generated files from its image context.
│   ├── .gitattributes                 # Configures Git LFS handling for large and binary files.
│   ├── .gitignore                     # Excludes frontend dependencies, build output, and local files from Git.
│   ├── .mise.toml                     # Pins the Node.js and pnpm tool versions.
│   ├── AGENTS.md                      # Provides frontend project and contribution guidance.
│   ├── CLAUDE.md                      # Points AI coding tools to the frontend guidance.
│   ├── .tsupgrader/
│   │   └── runtime-validation/
│   │       ├── eval-plan.json         # Describes recorded frontend validation checks.
│   │       └── standalone-result.json # Stores results from a frontend validation run.
│   ├── Dockerfile                     # Installs frontend dependencies and starts the Vite server.
│   ├── index.html                     # HTML shell that loads the React application.
│   ├── package.json                   # Declares frontend dependencies and package scripts.
│   ├── pnpm-lock.yaml                 # Locks the frontend dependency versions.
│   ├── tsconfig.json                  # Configures TypeScript compilation and source aliases.
│   ├── vite.config.ts                 # Configures Vite, React, Tailwind CSS, and the backend API proxy.
│   ├── public/
│   │   └── favicon.svg                # Browser icon for the frontend.
│   └── src/
│       ├── App.tsx                    # Defines the dashboard shell and page navigation.
│       ├── app-state.tsx              # Shares overview and historical analysis state across pages.
│       ├── dashboard-data.ts          # Supplies dashboard rows and derived accuracy metrics.
│       ├── index.css                  # Contains global dashboard styles.
│       ├── main.tsx                   # Mounts the React application and imports global styles.
│       ├── vite-env.d.ts              # Provides Vite client type declarations.
│       ├── api/
│       │   └── historicalAccuracy.ts  # Fetches and validates historical accuracy API responses.
│       ├── pages/
│       │   ├── comparison.tsx         # Displays historical forecast-versus-actual comparisons.
│       │   ├── error-analysis.tsx     # Displays historical forecast-error analysis.
│       │   └── overview.tsx           # Displays forecast, actual, and publication details.
│       └── ui/
│           └── components/
│               ├── AccuracyMethodNote.tsx       # Explains data sources and accuracy calculations.
│               ├── AccuracyMetrics.tsx           # Displays forecast accuracy metrics.
│               ├── ForecastActualChart.tsx      # Charts historical forecasts and actual generation.
│               ├── ForecastActualChart.test.tsx # Tests chart rendering and metric formatting.
│               ├── LargestErrorsTable.tsx       # Lists matched records with the largest forecast errors.
│               └── LargestErrorsTable.test.tsx  # Tests error ordering, missing records, and formatting.
├── back/
│   ├── .dockerignore                  # Excludes Python environments, caches, and local environment files.
│   ├── Dockerfile                     # Builds the Python API image and launches it with Uvicorn.
│   ├── main.py                        # Implements FastAPI endpoints and Elexon BMRS data analysis.
│   ├── requirements.txt               # Lists the backend Python dependencies.
│   └── test_main.py                   # Contains backend API tests.
└── README.md
```

## Deployment

- **Frontend:** [WindSight Dashboard](FRONTEND_DEPLOYMENT_URL)
- **Backend API:** [WindSight API](BACKEND_DEPLOYMENT_URL)
- **API Documentation:** [Swagger UI](BACKEND_DEPLOYMENT_URL/docs)

*Replace the placeholder URLs with the actual Vercel deployment URLs once deployment is complete.*

## Running the Application with Docker

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/kalana531531/jklmn.git
cd jklmn
```

### 2. Build and start the containers

Run the following command from the project root directory:

```bash
docker compose up --build -d
```

This command builds the frontend and backend Docker images and starts both services in the background.

### 3. Access the application

| Service | URL |
|---|---|
| Frontend Dashboard | http://localhost:8443 |
| Backend API | http://localhost:8000 |
| Swagger API Documentation | http://localhost:8000/docs |

### 4. Stop the application

To stop and remove the running containers, execute:

```bash
docker compose down
```

## API Integration

WindSight uses the Elexon BMRS API as its external data source for UK electricity generation information.

The backend communicates with the external API and provides data to the frontend.

The frontend accesses backend endpoints through `/api` routes. When running through Docker Compose, the frontend connects to the backend service using the Docker service hostname.

## AI Tools Used

AI tools were used as development assistants during this project.

- **ChatGPT (OpenAI):** Used for development guidance, troubleshooting, Docker configuration, debugging, documentation assistance, and deployment guidance.

AI-generated suggestions were reviewed, adapted where necessary, and tested during development. The developer remains responsible for the final implementation and project decisions.

## Author

**Kalana Ekanayake**

Computer Science Undergraduate  
University of Colombo School of Computing (UCSC)

GitHub: [kalana531531](https://github.com/kalana531531)

---

*WindSight – UK Wind Generation Forecast Monitor*