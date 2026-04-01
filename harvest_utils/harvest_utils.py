from datetime import datetime, timedelta
from typing import Any, Dict, List
import os

import requests


FORECAST_API_URL = "https://api.forecastapp.com/"
HARVEST_API_URL = "https://api.harvestapp.com/v2/"


def get_headers(provider : str="Harvest") -> Dict[str, str]:
    """
        Returns the headers for Forecast API requests

    Returns:
        headers: dict
            headers for Forecast and Harvest API requests

    """
    if provider not in ("Forecast", "Harvest"):
        raise ValueError(f"Provider '{provider}' not recognized")

    id_key = f"{provider.upper()}_ACCOUNT_ID"
    headers = {
        "Accept": "application/json",
        "Authorization": "Bearer " + os.environ.get("HARVEST_ACCESS_TOKEN", ""),
        f"{provider}-Account-ID": os.environ.get(id_key),
        "User-Agent": "openteams-ai/tsbot",
    }
    return headers


def get_harvest(endpoint : str):
    """Get data from a Harvest endpoint."""
    params = {"per_page": 2000, "page": 1}
    headers = get_headers("Harvest")
    endpoint_url = f"{HARVEST_API_URL}{endpoint}"
    return _get_and_unpack(endpoint_url, headers, params)


def get_forecast(endpoint : str):
    """Get data from a Forecast endpoint."""
    # We want to handle allocations in the previous month(ish)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=31)

    start_date_str = str(start_date.date())
    end_date_str = str(end_date.date())

    params = {
        "start_date": start_date_str,
        "end_date": end_date_str,
    }
    
    endpoint_url = f"{FORECAST_API_URL}{endpoint}"
    headers = get_headers("Forecast")
    return _get_and_unpack(endpoint_url, headers, params)


def _get_and_unpack(endpoint_url, headers, params):
    response = requests.get(endpoint_url, headers=headers, params=params)
    if response.status_code == 200:
        return response.json()
    return {}