
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from time import perf_counter
from zoneinfo import ZoneInfo
import asyncio
import math
import httpx

app = FastAPI(
    title="UK Wind Generation Forecast Monitor API",
    description="Backend API for wind generation forecasts and actuals.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8443",
        "http://127.0.0.1:8443",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
ELEXON_CACHE_TTL_SECONDS = 600
ELEXON_RESPONSE_CACHE = {}
ELEXON_CACHE_LOCKS = {}
MAX_FORECAST_VERSION_QUERIES = 100


async def fetch_elexon_json(client, endpoint, params):
    cache_key = (
        endpoint,
        tuple(sorted((key, str(value)) for key, value in params.items())),
    )
    now = perf_counter()
    cached = ELEXON_RESPONSE_CACHE.get(cache_key)
    if cached is not None and cached[0] > now:
        return cached[1], True

    lock = ELEXON_CACHE_LOCKS.setdefault(cache_key, asyncio.Lock())
    async with lock:
        now = perf_counter()
        cached = ELEXON_RESPONSE_CACHE.get(cache_key)
        if cached is not None and cached[0] > now:
            return cached[1], True

        response = await client.get(
            f"{ELEXON_BASE_URL}{endpoint}",
            params=params,
        )
        response.raise_for_status()
        payload = response.json()

        if len(ELEXON_RESPONSE_CACHE) >= 128:
            for key, (expires_at, _) in list(ELEXON_RESPONSE_CACHE.items()):
                if expires_at <= now:
                    ELEXON_RESPONSE_CACHE.pop(key, None)
            if len(ELEXON_RESPONSE_CACHE) >= 128:
                oldest_key = next(iter(ELEXON_RESPONSE_CACHE))
                ELEXON_RESPONSE_CACHE.pop(oldest_key, None)

        ELEXON_RESPONSE_CACHE[cache_key] = (
            perf_counter() + ELEXON_CACHE_TTL_SECONDS,
            payload,
        )
        return payload, False


@app.get("/")
def root():
    return {
        "message": "Welcome to the UK Wind Generation Forecast Monitor API",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Wind Generation Forecast Monitor backend is running",
    }

#fetches forcast value
@app.get("/api/forecasts/wind")
async def get_wind_forecasts(
    start: str = "2026-10-26T00:00:00Z",
    end: str = "2026-10-27T00:00:00Z",
):
    url = f"{ELEXON_BASE_URL}/forecast/generation/wind/latest"
    params = {
        "from": start,
        "to": end,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            result = response.json()

        return {
            "source": "Elexon BMRS",
            "dataset": "WINDFOR",
            "count": len(result.get("data", [])),
            "data": result.get("data", []),
        }

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Elexon returned HTTP {exc.response.status_code}. "
                f"URL: {exc.request.url}. "
                f"Response: {exc.response.text[:500]}"
            ),
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Elexon connection error: {type(exc).__name__}: {exc!r}",
        )


#actual value
@app.get("/api/actuals/wind")
async def get_wind_actuals(
    start: str = "2026-10-26T00:00:00Z",
    end: str = "2026-10-27T00:00:00Z",
):
    url = f"{ELEXON_BASE_URL}/datasets/FUELHH/stream"
    params = {
        "from": start,
        "to": end,
        "fuelType": "WIND",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            records = response.json()

        wind_records = [
            record
            for record in records
            if record.get("fuelType") == "WIND"
        ]

        return {
            "source": "Elexon BMRS",
            "dataset": "FUELHH",
            "fuelType": "WIND",
            "count": len(wind_records),
            "data": wind_records,
        }

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve wind actuals from Elexon: {exc}",
        )



#compares Elexon wind generation forecasts with actual wind generation.

@app.get("/api/analysis/wind")
async def analyze_wind_generation(
    start: str = "2026-01-26T00:00:00Z",
    end: str = "2026-01-27T00:00:00Z",
):
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            forecast_response = await client.get(
                f"{ELEXON_BASE_URL}/forecast/generation/wind/latest",
                params={"from": start, "to": end},
            )
            forecast_response.raise_for_status()

            actual_response = await client.get(
                f"{ELEXON_BASE_URL}/generation/actual/per-type/wind-and-solar",
                params={"from": start, "to": end},
            )
            actual_response.raise_for_status()

        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not retrieve Elexon data: {exc}",
            )

    forecasts = forecast_response.json().get("data", [])
    actual_records = actual_response.json().get("data", [])

    # Combine onshore and offshore wind generation by settlement period.
    actual_by_period = {}

    for item in actual_records:
        if item.get("psrType") not in ("Wind Onshore", "Wind Offshore"):
            continue

        key = (item["settlementDate"], item["settlementPeriod"])
        actual_by_period[key] = (
            actual_by_period.get(key, 0) + item["quantity"]
        )

    results = []

    for forecast in forecasts:
        key = (
            forecast["settlementDate"],
            forecast["settlementPeriod"],
        )

        actual_value = actual_by_period.get(key)
        forecast_value = forecast.get("generation")

        error = (
            forecast_value - actual_value
            if actual_value is not None and forecast_value is not None
            else None
        )

        results.append({
            "settlementDate": forecast["settlementDate"],
            "settlementPeriod": forecast["settlementPeriod"],
            "startTime": forecast["startTime"],
            "forecastPublishTime": forecast["publishTime"],
            "forecastMW": forecast_value,
            "actualMW": round(actual_value, 3)
                if actual_value is not None else None,
            "forecastErrorMW": round(error, 3)
                if error is not None else None,
            "absoluteErrorMW": round(abs(error), 3)
                if error is not None else None,
        })

    matched_errors = [
        item["forecastErrorMW"]
        for item in results
        if item["forecastErrorMW"] is not None
    ]

    matched_count = len(matched_errors)

    return {
        "source": "Elexon BMRS",
        "forecastDataset": "WINDFOR",
        "actualDataset": "AGWS",
        "count": len(results),
        "matchedCount": matched_count,
        "MAE": round(
            sum(abs(error) for error in matched_errors) / matched_count, 3
        ) if matched_count else None,
        "RMSE": round(
            (sum(error ** 2 for error in matched_errors) / matched_count) ** 0.5,
            3,
        ) if matched_count else None,
        "meanSignedError": round(
            sum(matched_errors) / matched_count, 3
        ) if matched_count else None,
        "data": results,
    }


@app.get("/api/analysis/wind/decision")
async def analyze_wind_decision(
    delivery_date: str = "2026-01-06",
    settlement_period: int = 19,
    cutoff_time: str = "16:30",
    forecast_publish_time: str | None = None,
):
    # Validate the requested delivery date, period, and cut-off.
    try:
        delivery_day = date.fromisoformat(delivery_date)
        cutoff_clock = time.fromisoformat(cutoff_time)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Use delivery_date=YYYY-MM-DD and cutoff_time=HH:MM.",
        )

    if not 1 <= settlement_period <= 48:
        raise HTTPException(
            status_code=400,
            detail="Settlement period must be between 1 and 48.",
        )

    london = ZoneInfo("Europe/London")

    # Day-ahead means the cut-off is on the previous calendar day in London.
    cutoff_local = datetime.combine(
        delivery_day - timedelta(days=1),
        cutoff_clock,
        tzinfo=london,
    )
    cutoff_utc = cutoff_local.astimezone(timezone.utc)

    # Convert the delivery day's London boundaries to UTC.
    delivery_start = datetime.combine(
        delivery_day, time.min, tzinfo=london
    ).astimezone(timezone.utc)

    delivery_end = datetime.combine(
        delivery_day + timedelta(days=1), time.min, tzinfo=london
    ).astimezone(timezone.utc)

    def utc_string(value: datetime) -> str:
        return value.isoformat().replace("+00:00", "Z")

    requested_publish_time = None
    if forecast_publish_time is not None:
        try:
            requested_publish_time = datetime.fromisoformat(
                forecast_publish_time.replace("Z", "+00:00")
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Use forecast_publish_time as an ISO 8601 timestamp.",
            )

        if (
            requested_publish_time.tzinfo is None
            or requested_publish_time > cutoff_utc
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Forecast publication must include a time zone and must "
                    "not be after the decision cut-off."
                ),
            )
        requested_publish_time = requested_publish_time.astimezone(timezone.utc)

    # Find the forecast for the selected delivery hour.
    # Elexon WINDFOR data is hourly, represented by odd settlement periods.
    forecast_period = (
        settlement_period
        if settlement_period % 2 == 1
        else settlement_period - 1
    )

    forecast_versions = []
    seen_publish_times = set()
    query_time = cutoff_utc

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for _ in range(MAX_FORECAST_VERSION_QUERIES):
                snapshot, _ = await fetch_elexon_json(
                    client,
                    "/forecast/generation/wind/history",
                    {"publishTime": utc_string(query_time)},
                )
                eligible_forecasts = []

                for item in snapshot.get("data", []):
                    generation = item.get("generation")
                    published_at = item.get("publishTime")
                    if (
                        item.get("settlementDate") != delivery_date
                        or item.get("settlementPeriod") != forecast_period
                        or not isinstance(published_at, str)
                        or not isinstance(generation, (int, float))
                        or not math.isfinite(generation)
                    ):
                        continue

                    try:
                        published_time = datetime.fromisoformat(
                            published_at.replace("Z", "+00:00")
                        )
                    except ValueError:
                        continue
                    if published_time.tzinfo is None or published_time > query_time:
                        continue
                    eligible_forecasts.append(
                        (published_time, published_at, float(generation))
                    )

                if not eligible_forecasts:
                    break

                published_time, published_at, generation = max(
                    eligible_forecasts,
                    key=lambda version: version[0],
                )
                if published_at in seen_publish_times:
                    raise HTTPException(
                        status_code=502,
                        detail="Elexon returned a repeated forecast publication version.",
                    )

                seen_publish_times.add(published_at)
                forecast_versions.append({
                    "publishTime": published_at,
                    "forecastMW": generation,
                })
                query_time = published_time - timedelta(seconds=1)
            else:
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "Could not enumerate all forecast publications within "
                        f"{MAX_FORECAST_VERSION_QUERIES} Elexon history requests."
                    ),
                )

            actual_response, _ = await fetch_elexon_json(
                client,
                "/generation/actual/per-type/wind-and-solar",
                {
                    "from": utc_string(delivery_start),
                    "to": utc_string(delivery_end),
                },
            )
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Elexon returned HTTP {exc.response.status_code} while "
                "retrieving forecast decision data."
            ),
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve Elexon decision data: {exc}",
        )

    forecast_versions.sort(
        key=lambda version: datetime.fromisoformat(
            version["publishTime"].replace("Z", "+00:00")
        ),
        reverse=True,
    )

    selected_version = forecast_versions[0] if forecast_versions else None
    if requested_publish_time is not None:
        selected_version = next(
            (
                version
                for version in forecast_versions
                if datetime.fromisoformat(
                    version["publishTime"].replace("Z", "+00:00")
                ).astimezone(timezone.utc) == requested_publish_time
            ),
            None,
        )
        if selected_version is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "The requested forecast publication is not available for "
                    "this delivery period and decision cut-off."
                ),
            )

    # Sum onshore and offshore actual generation for each half-hour.
    actual_records = actual_response.get("data", [])
    actual_by_period = {}

    for item in actual_records:
        if (
            item.get("settlementDate") != delivery_date
            or item.get("psrType") not in ("Wind Onshore", "Wind Offshore")
        ):
            continue

        key = item["settlementPeriod"]
        actual_by_period[key] = (
            actual_by_period.get(key, 0.0) + float(item["quantity"])
        )

    # WINDFOR is hourly, but the selected half-hour actual must remain exact.
    actual_mw = (
        round(actual_by_period[settlement_period], 3)
        if settlement_period in actual_by_period
        else None
    )

    forecast_mw = (
        selected_version["forecastMW"] if selected_version is not None else None
    )

    error_mw = (
        forecast_mw - actual_mw
        if forecast_mw is not None and actual_mw is not None
        else None
    )

    return {
        "source": "Elexon BMRS",
        "forecastDataset": "WINDFOR",
        "actualDataset": "AGWS",
        "deliveryDate": delivery_date,
        "requestedSettlementPeriod": settlement_period,
        "forecastSettlementPeriod": forecast_period,
        "cutoffLocal": cutoff_local.isoformat(),
        "cutoffUTC": utc_string(cutoff_utc),
        "forecastPublishTime": (
            selected_version["publishTime"] if selected_version else None
        ),
        "forecastVersions": forecast_versions,
        "forecastMW": forecast_mw,
        "actualMW": actual_mw,
        "forecastErrorMW": (
            round(error_mw, 3) if error_mw is not None else None
        ),
        "absoluteErrorMW": (
            round(abs(error_mw), 3) if error_mw is not None else None
        ),
        "forecastAvailable": forecast_mw is not None,
        "actualAvailable": actual_mw is not None,
    }


@app.get("/api/analysis/wind/historical-accuracy")
async def analyze_wind_historical_accuracy(
    start_date: date = date(2026, 1, 6),
    end_date: date = date(2026, 1, 12),
):
    if start_date.year != 2026 or start_date.month != 1:
        raise HTTPException(
            status_code=400,
            detail="Historical accuracy is available for January 2026 only.",
        )

    if end_date.year != 2026 or end_date.month != 1:
        raise HTTPException(
            status_code=400,
            detail="Historical accuracy is available for January 2026 only.",
        )

    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date must be on or after start_date.",
        )

    delivery_dates = [
        start_date + timedelta(days=offset)
        for offset in range((end_date - start_date).days + 1)
    ]
    requested_delivery_dates = {day.isoformat() for day in delivery_dates}

    london = ZoneInfo("Europe/London")

    def utc_string(value: datetime) -> str:
        return value.isoformat().replace("+00:00", "Z")

    cutoffs = {
        delivery_day: datetime.combine(
            delivery_day - timedelta(days=1),
            time(16, 30),
            tzinfo=london,
        ).astimezone(timezone.utc)
        for delivery_day in delivery_dates
    }

    actual_chunks = []
    for offset in range(0, len(delivery_dates), 7):
        chunk_dates = delivery_dates[offset:offset + 7]
        chunk_start = datetime.combine(
            chunk_dates[0], time.min, tzinfo=london
        ).astimezone(timezone.utc)
        chunk_end = (
            datetime.combine(
                chunk_dates[-1] + timedelta(days=1),
                time.min,
                tzinfo=london,
            ).astimezone(timezone.utc)
            - timedelta(minutes=30)
        )
        actual_chunks.append((chunk_start, chunk_end))

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            request_semaphore = asyncio.Semaphore(5)

            async def fetch_forecast(cutoff: datetime):
                async with request_semaphore:
                    return await fetch_elexon_json(
                        client,
                        "/forecast/generation/wind/history",
                        {"publishTime": utc_string(cutoff)},
                    )

            async def fetch_actuals(chunk_start: datetime, chunk_end: datetime):
                async with request_semaphore:
                    return await fetch_elexon_json(
                        client,
                        "/generation/actual/per-type/wind-and-solar",
                        {
                            "from": utc_string(chunk_start),
                            "to": utc_string(chunk_end),
                        },
                    )

            async def fetch_forecasts():
                started = perf_counter()
                results = await asyncio.gather(*[
                    fetch_forecast(cutoff) for cutoff in cutoffs.values()
                ])
                return results, round((perf_counter() - started) * 1000, 1)

            async def fetch_actual_chunks():
                started = perf_counter()
                results = await asyncio.gather(*[
                    fetch_actuals(chunk_start, chunk_end)
                    for chunk_start, chunk_end in actual_chunks
                ])
                return results, round((perf_counter() - started) * 1000, 1)

            (forecast_results, forecast_fetch_ms), (
                actual_results, actual_fetch_ms
            ) = await asyncio.gather(
                fetch_forecasts(),
                fetch_actual_chunks(),
            )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Elexon returned HTTP {exc.response.status_code} while "
                f"retrieving historical wind accuracy data."
            ),
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve historical Elexon data: {exc}",
        )

    forecast_responses = [result[0] for result in forecast_results]
    actual_responses = [result[0] for result in actual_results]
    cache_hits = sum(result[1] for result in forecast_results + actual_results)
    cache_misses = len(forecast_results) + len(actual_results) - cache_hits

    processing_started = perf_counter()
    forecast_by_period = {}
    for delivery_day, payload in zip(cutoffs, forecast_responses):
        cutoff = cutoffs[delivery_day]
        for item in payload.get("data", []):
            if item.get("settlementDate") != delivery_day.isoformat():
                continue

            period = item.get("settlementPeriod")
            published_at = item.get("publishTime")
            generation = item.get("generation")
            if (
                not isinstance(period, int)
                or period < 1
                or period > 47
                or period % 2 == 0
                or not isinstance(published_at, str)
                or not isinstance(generation, (int, float))
                or not math.isfinite(generation)
            ):
                continue

            published_time = datetime.fromisoformat(
                published_at.replace("Z", "+00:00")
            )
            if published_time > cutoff:
                continue

            key = (delivery_day.isoformat(), period)
            existing = forecast_by_period.get(key)
            if existing is None or published_time > existing["publishedTime"]:
                forecast = {
                    "generation": Decimal(str(generation)),
                    "publishTime": published_at,
                    "publishedTime": published_time,
                }
                forecast_by_period[key] = forecast
                forecast_by_period[(delivery_day.isoformat(), period + 1)] = forecast

    actual_by_component = {}
    for payload in actual_responses:
        for item in payload.get("data", []):
            delivery_day = item.get("settlementDate")
            period = item.get("settlementPeriod")
            component = item.get("psrType")
            quantity = item.get("quantity")
            published_at = item.get("publishTime")
            if (
                delivery_day not in requested_delivery_dates
                or not isinstance(period, int)
                or period < 1
                or period > 48
                or component not in ("Wind Onshore", "Wind Offshore")
                or not isinstance(quantity, (int, float))
                or not math.isfinite(quantity)
                or not isinstance(published_at, str)
            ):
                continue

            published_time = datetime.fromisoformat(
                published_at.replace("Z", "+00:00")
            )
            key = (delivery_day, period, component)
            existing = actual_by_component.get(key)
            if existing is None or published_time > existing["publishedTime"]:
                actual_by_component[key] = {
                    "quantity": Decimal(str(quantity)),
                    "publishedTime": published_time,
                }

    actual_by_period = {}
    for (delivery_day, period, component), record in actual_by_component.items():
        period_key = (delivery_day, period)
        actual_by_period.setdefault(period_key, {})[component] = record["quantity"]

    complete_actual_mw = {}
    for key, components in actual_by_period.items():
        if "Wind Onshore" in components and "Wind Offshore" in components:
            complete_actual_mw[key] = (
                components["Wind Onshore"] + components["Wind Offshore"]
            )

    records = []
    for delivery_day in delivery_dates:
        delivery_date = delivery_day.isoformat()
        cutoff = utc_string(cutoffs[delivery_day])
        local_midnight = datetime.combine(
            delivery_day, time.min, tzinfo=london
        )
        for period in range(1, 49):
            timestamp = local_midnight + timedelta(minutes=(period - 1) * 30)
            forecast = forecast_by_period.get((delivery_date, period))
            actual_mw = complete_actual_mw.get((delivery_date, period))
            forecast_mw = forecast["generation"] if forecast else None
            error_mw = (
                forecast_mw - actual_mw
                if forecast_mw is not None and actual_mw is not None
                else None
            )
            records.append({
                "deliveryDate": delivery_date,
                "settlementPeriod": period,
                "timestamp": utc_string(timestamp.astimezone(timezone.utc)),
                "forecastMW": forecast_mw,
                "actualMW": actual_mw,
                "forecastErrorMW": error_mw,
                "forecastPublishTime": (
                    forecast["publishTime"] if forecast else None
                ),
                "cutoffTime": cutoff,
            })

    matched_records = [
        record for record in records
        if record["forecastErrorMW"] is not None
    ]
    errors = [record["forecastErrorMW"] for record in matched_records]
    absolute_errors = [abs(error) for error in errors]
    mape_records = [
        record
        for record in matched_records
        if abs(record["actualMW"]) > 1
    ]
    matched_count = len(matched_records)
    mape_count = len(mape_records)

    processing_ms = round((perf_counter() - processing_started) * 1000, 1)
    return {
        "source": "Elexon BMRS",
        "forecastDataset": "WINDFOR",
        "actualDataset": "AGWS",
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "matchedCount": matched_count,
        "metrics": {
            "count": matched_count,
            "mae": sum(absolute_errors) / matched_count
            if matched_count else None,
            "rmse": math.sqrt(
                sum(error ** 2 for error in errors) / matched_count
            ) if matched_count else None,
            "mapePercent": (
                sum(
                    abs(record["forecastErrorMW"] / record["actualMW"]) * 100
                    for record in mape_records
                ) / mape_count
            ) if mape_count else None,
            "bias": sum(errors) / matched_count
            if matched_count else None,
            "mapeCount": mape_count,
        },
        "dataAvailability": {
            "forecastRecords": sum(
                record["forecastMW"] is not None for record in records
            ),
            "actualHalfHourlyPeriods": len(complete_actual_mw),
            "matchedRecords": matched_count,
            "forecastMissingPeriods": sum(
                record["forecastMW"] is None for record in records
            ),
            "actualMissingPeriods": sum(
                record["actualMW"] is None for record in records
            ),
        },
        "performance": {
            "forecastFetchMs": forecast_fetch_ms,
            "actualFetchMs": actual_fetch_ms,
            "processingMs": processing_ms,
            "cacheHits": cache_hits,
            "cacheMisses": cache_misses,
        },
        "data": records,
    }
