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
│
├── front/
│   ├── src/
│   │   ├── api/
│   │   └── ...
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── vite.config.ts
│   └── index.html
│
├── back/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── .dockerignore
├── compose.yaml
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

To rebuild the containers after making source-code or configuration changes, run:

```bash
docker compose up --build -d
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