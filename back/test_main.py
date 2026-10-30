import unittest
from datetime import datetime, timedelta
from math import sqrt
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app


class WindDecisionPublicationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.publication_rows = {
            "2026-01-05T16:30:00Z": [
                {
                    "settlementDate": "2026-01-06",
                    "settlementPeriod": 19,
                    "publishTime": "2026-01-05T17:00:00Z",
                    "generation": 999,
                },
                {
                    "settlementDate": "2026-01-06",
                    "settlementPeriod": 19,
                    "publishTime": "2026-01-05T15:30:00Z",
                    "generation": 100,
                },
            ],
            "2026-01-05T15:29:59Z": [
                {
                    "settlementDate": "2026-01-06",
                    "settlementPeriod": 19,
                    "publishTime": "2026-01-05T11:30:00Z",
                    "generation": 80,
                },
            ],
            "2026-01-05T11:29:59Z": [],
        }

    async def fake_fetch(self, client, endpoint, params):
        if endpoint == "/forecast/generation/wind/history":
            return {
                "data": self.publication_rows.get(params["publishTime"], [])
            }, False

        return {
            "data": [
                {"settlementDate": "2026-01-06", "settlementPeriod": 19,
                 "psrType": "Wind Onshore", "quantity": 100},
                {"settlementDate": "2026-01-06", "settlementPeriod": 19,
                 "psrType": "Wind Offshore", "quantity": 10},
                {"settlementDate": "2026-01-06", "settlementPeriod": 20,
                 "psrType": "Wind Onshore", "quantity": 120},
                {"settlementDate": "2026-01-06", "settlementPeriod": 20,
                 "psrType": "Wind Offshore", "quantity": 10},
                {"settlementDate": "2026-01-06", "settlementPeriod": 19,
                 "psrType": "Solar", "quantity": 500},
                {"settlementDate": "2026-01-06", "settlementPeriod": 20,
                 "psrType": "Solar", "quantity": 700},
            ]
        }, False

    def setUpFetch(self):
        return patch("main.fetch_elexon_json", new=self.fake_fetch)

    def test_returns_real_publications_newest_first_and_excludes_after_cutoff(self):
        with self.setUpFetch():
            response = self.client.get(
                "/api/analysis/wind/decision",
                params={"delivery_date": "2026-01-06", "settlement_period": 19},
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(
            result["forecastVersions"],
            [
                {"publishTime": "2026-01-05T15:30:00Z", "forecastMW": 100.0},
                {"publishTime": "2026-01-05T11:30:00Z", "forecastMW": 80.0},
            ],
        )
        self.assertEqual(result["forecastPublishTime"], "2026-01-05T15:30:00Z")
        self.assertEqual(result["forecastMW"], 100.0)
        self.assertNotIn("2026-01-05T17:00:00Z", {
            version["publishTime"] for version in result["forecastVersions"]
        })

    def test_each_publication_selects_its_exact_forecast_and_recomputes_error(self):
        expected_forecasts = {
            "2026-01-05T15:30:00Z": 100.0,
            "2026-01-05T11:30:00Z": 80.0,
        }

        with self.setUpFetch():
            for publish_time, expected_forecast in expected_forecasts.items():
                response = self.client.get(
                    "/api/analysis/wind/decision",
                    params={
                        "delivery_date": "2026-01-06",
                        "settlement_period": 19,
                        "forecast_publish_time": publish_time,
                    },
                )
                self.assertEqual(response.status_code, 200)
                result = response.json()
                self.assertEqual(result["forecastPublishTime"], publish_time)
                self.assertEqual(result["forecastMW"], expected_forecast)
                self.assertEqual(result["actualMW"], 110.0)
                self.assertEqual(
                    result["forecastErrorMW"], expected_forecast - 110.0
                )

    def test_rejects_publication_after_decision_cutoff(self):
        with self.setUpFetch():
            response = self.client.get(
                "/api/analysis/wind/decision",
                params={
                    "delivery_date": "2026-01-06",
                    "settlement_period": 19,
                    "forecast_publish_time": "2026-01-05T17:00:00Z",
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("must not be after", response.json()["detail"])

    def test_even_settlement_period_keeps_half_hour_mapping(self):
        with self.setUpFetch():
            response = self.client.get(
                "/api/analysis/wind/decision",
                params={"delivery_date": "2026-01-06", "settlement_period": 20},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["requestedSettlementPeriod"], 20)
        self.assertEqual(response.json()["forecastSettlementPeriod"], 19)
        self.assertEqual(response.json()["forecastMW"], 100.0)
        self.assertEqual(response.json()["actualMW"], 130.0)
        self.assertEqual(response.json()["forecastErrorMW"], -30.0)

    def test_reports_when_no_eligible_publication_exists(self):
        with self.setUpFetch():
            response = self.client.get(
                "/api/analysis/wind/decision",
                params={
                    "delivery_date": "2026-01-07",
                    "settlement_period": 19,
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["forecastVersions"], [])
        self.assertIsNone(response.json()["forecastPublishTime"])
        self.assertIsNone(response.json()["forecastMW"])


class HistoricalAccuracyVintageTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    async def fake_fetch(self, client, endpoint, params):
        if endpoint == "/forecast/generation/wind/history":
            cutoff = datetime.fromisoformat(
                params["publishTime"].replace("Z", "+00:00")
            )
            delivery_date = (cutoff.date() + timedelta(days=1)).isoformat()
            return {
                "data": [
                    {
                        "settlementDate": delivery_date,
                        "settlementPeriod": 1,
                        "publishTime": (
                            cutoff - timedelta(hours=1)
                        ).isoformat().replace("+00:00", "Z"),
                        "generation": 1000,
                    },
                    {
                        "settlementDate": delivery_date,
                        "settlementPeriod": 1,
                        "publishTime": params["publishTime"],
                        "generation": 1100,
                    },
                    {
                        "settlementDate": delivery_date,
                        "settlementPeriod": 3,
                        "publishTime": "2026-01-15T12:00:00Z",
                        "generation": 9999,
                    },
                    {
                        "settlementDate": "2026-01-10",
                        "settlementPeriod": 5,
                        "publishTime": "2026-01-15T12:00:00Z",
                        "generation": 9999,
                    },
                ]
            }, False

        actuals = []
        for offset in range(4):
            delivery_date = (
                datetime(2026, 1, 10) + timedelta(days=offset)
            ).date().isoformat()
            actuals.extend([
                {
                    "settlementDate": delivery_date,
                    "settlementPeriod": 1,
                    "psrType": "Wind Onshore",
                    "quantity": 100 + offset,
                    "publishTime": "2026-01-15T12:00:00Z",
                },
                {
                    "settlementDate": delivery_date,
                    "settlementPeriod": 1,
                    "psrType": "Wind Offshore",
                    "quantity": 50,
                    "publishTime": "2026-01-15T12:00:00Z",
                },
            ])
        return {"data": actuals}, False

    def test_selects_each_delivery_day_vintage_and_rejects_january_15_updates(self):
        with patch("main.fetch_elexon_json", new=self.fake_fetch):
            response = self.client.get(
                "/api/analysis/wind/historical-accuracy",
                params={
                    "start_date": "2026-01-10",
                    "end_date": "2026-01-13",
                },
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["matchedCount"], 4)
        self.assertEqual(result["metrics"]["count"], 4)

        for offset in range(4):
            delivery_date = (
                datetime(2026, 1, 10) + timedelta(days=offset)
            ).date().isoformat()
            day_records = [
                row for row in result["data"]
                if row["deliveryDate"] == delivery_date
            ]
            matched = next(row for row in day_records if row["settlementPeriod"] == 1)
            later_update = next(row for row in day_records if row["settlementPeriod"] == 3)
            self.assertEqual(matched["forecastMW"], 1100.0)
            self.assertEqual(
                matched["forecastPublishTime"],
                matched["cutoffTime"],
            )
            self.assertIsNone(later_update["forecastMW"])
            self.assertIsNone(later_update["forecastPublishTime"])


class HistoricalAccuracyPrecisionTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    async def fake_fetch(self, client, endpoint, params):
        if endpoint == "/forecast/generation/wind/history":
            return {
                "data": [{
                    "settlementDate": "2026-01-06",
                    "settlementPeriod": 19,
                    "publishTime": "2026-01-05T15:30:00Z",
                    "generation": 7688.0004,
                }]
            }, False

        return {
            "data": [
                {
                    "settlementDate": "2026-01-06",
                    "settlementPeriod": 19,
                    "psrType": "Wind Onshore",
                    "quantity": 2958.2044,
                    "publishTime": "2026-01-06T12:00:00Z",
                },
                {
                    "settlementDate": "2026-01-06",
                    "settlementPeriod": 19,
                    "psrType": "Wind Offshore",
                    "quantity": 4102.2814,
                    "publishTime": "2026-01-06T12:00:00Z",
                },
                {
                    "settlementDate": "2026-01-06",
                    "settlementPeriod": 20,
                    "psrType": "Wind Onshore",
                    "quantity": 2939.7374,
                    "publishTime": "2026-01-06T12:00:00Z",
                },
                {
                    "settlementDate": "2026-01-06",
                    "settlementPeriod": 20,
                    "psrType": "Wind Offshore",
                    "quantity": 4199.0124,
                    "publishTime": "2026-01-06T12:00:00Z",
                },
            ]
        }, False

    def test_api_records_and_metrics_use_unrounded_generation_values(self):
        with patch("main.fetch_elexon_json", new=self.fake_fetch):
            response = self.client.get(
                "/api/analysis/wind/historical-accuracy",
                params={
                    "start_date": "2026-01-06",
                    "end_date": "2026-01-06",
                },
            )

        self.assertEqual(response.status_code, 200)
        result = response.json()
        period_19 = next(
            row for row in result["data"] if row["settlementPeriod"] == 19
        )
        self.assertAlmostEqual(period_19["forecastMW"], 7688.0004)
        self.assertAlmostEqual(period_19["actualMW"], 7060.4858)
        self.assertAlmostEqual(period_19["forecastErrorMW"], 627.5146)
        self.assertAlmostEqual(result["metrics"]["mae"], 588.3826)
        expected_rmse = sqrt((627.5146 ** 2 + 549.2506 ** 2) / 2)
        self.assertAlmostEqual(result["metrics"]["rmse"], expected_rmse)
        expected_mape = (
            abs(627.5146 / 7060.4858) * 100
            + abs(549.2506 / 7138.7498) * 100
        ) / 2
        self.assertAlmostEqual(result["metrics"]["mapePercent"], expected_mape)
        self.assertAlmostEqual(result["metrics"]["bias"], 588.3826)


if __name__ == "__main__":
    unittest.main()
