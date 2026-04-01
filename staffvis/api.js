
const HARVEST_API_URL = "https://api.harvestapp.com/v2/";
const FORECAST_API_URL = "https://api.forecastapp.com/";
const USER_AGENT = "openteams-ai/staffvis";

/**
 * Fetches data from a given URL with specified headers and parameters.
 * Handles pagination for Harvest API.
 * @param {string} url The base URL for the API endpoint.
 * @param {Object} headers Headers for the request.
 * @param {Object} [queryParams={}] Query parameters for the request.
 * @param {string} [dataKey] The key in the JSON response that holds the array of items (e.g., 'users', 'assignments').
 * @returns {Promise<Array>} A promise that resolves to an array of all fetched items.
 */
async function fetchData(url, headers, queryParams = {}, dataKey) {
    let allItems = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const params = new URLSearchParams({
            ...queryParams,
        });

        // Harvest pagination parameters
        if (headers["Harvest-Account-ID"]) {
            params.append("page", page);
            params.append("per_page", 2000); // Harvest max per page
        }

        const fullUrl = `${url}?${params.toString()}`;

        try {
            const response = await fetch(fullUrl, { headers });
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorBody}`);
            }
            const data = await response.json();

            let items;
            const key = dataKey || Object.keys(data).find(k => Array.isArray(data[k]));

            if (key) {
                items = data[key];
            } else {
                items = [];
            }

            allItems = allItems.concat(items);

            // Check for Harvest-specific pagination
            if (headers["Harvest-Account-ID"] && data.page && data.total_pages && data.page < data.total_pages) {
                page++;
            } else {
                hasMore = false;
            }

        } catch (error) {
            console.error("Error fetching data:", error);
            hasMore = false; // Stop on error
            throw error; // Re-throw to propagate error
        }
    }
    return allItems;
}

/**
 * Generates headers for Harvest or Forecast API requests.
 * @param {string} provider 'Harvest' or 'Forecast'.
 * @param {string} accessToken Harvest Personal Access Token.
 * @param {string} accountId Harvest or Forecast Account ID.
 * @returns {Object} Headers object.
 */
function getApiHeaders(provider, accessToken, accountId) {
    if (!accessToken || !accountId) {
        throw new Error(`Missing accessToken or accountId for ${provider} API.`);
    }

    const headers = {
        "Accept": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
    };

    if (provider === "Harvest") {
        headers["Harvest-Account-ID"] = accountId;
    } else if (provider === "Forecast") {
        headers["Forecast-Account-ID"] = accountId;
    } else {
        throw new Error(`Provider '${provider}' not recognized.`);
    }
    return headers;
}

// --- Harvest API Functions ---

/**
 * Generic Harvest GET request.
 * @param {string} endpoint The API endpoint (e.g., 'users', 'projects', 'time_entries').
 * @param {string} harvestAccessToken Your Harvest Personal Access Token.
 * @param {string} harvestAccountId Your Harvest Account ID.
 * @param {Object} [queryParams={}] Additional query parameters.
 * @returns {Promise<Array>} A promise that resolves to an array of fetched items.
 */
async function getHarvest(endpoint, harvestAccessToken, harvestAccountId, queryParams = {}) {
    const headers = getApiHeaders("Harvest", harvestAccessToken, harvestAccountId);
    const url = `${HARVEST_API_URL}${endpoint}`;
    // Harvest endpoints usually match the data key, pluralized
    const dataKey = endpoint; 
    return fetchData(url, headers, queryParams, dataKey);
}

/**
 * Fetches all users from Harvest.
 * @param {string} harvestAccessToken Your Harvest Personal Access Token.
 * @param {string} harvestAccountId Your Harvest Account ID.
 * @returns {Promise<Array>} A promise that resolves to an array of Harvest user objects.
 */
export async function getHarvestUsers(harvestAccessToken, harvestAccountId) {
    return getHarvest("users", harvestAccessToken, harvestAccountId);
}

/**
 * Fetches all projects from Harvest.
 * @param {string} harvestAccessToken Your Harvest Personal Access Token.
 * @param {string} harvestAccountId Your Harvest Account ID.
 * @returns {Promise<Array>} A promise that resolves to an array of Harvest project objects.
 */
export async function getHarvestProjects(harvestAccessToken, harvestAccountId) {
    return getHarvest("projects", harvestAccessToken, harvestAccountId);
}

/**
 * Fetches time entries from Harvest within a specified date range.
 * @param {string} harvestAccessToken Your Harvest Personal Access Token.
 * @param {string} harvestAccountId Your Harvest Account ID.
 * @param {string} from YYYY-MM-DD start date.
 * @param {string} to YYYY-MM-DD end date.
 * @param {Object} [additionalQueryParams={}] Additional query parameters specific to time_entries.
 * @returns {Promise<Array>} A promise that resolves to an array of Harvest time entry objects.
 */
export async function getHarvestTimeEntries(harvestAccessToken, harvestAccountId, from, to, additionalQueryParams = {}) {
    const queryParams = {
        from: from,
        to: to,
        ...additionalQueryParams
    };
    return getHarvest("time_entries", harvestAccessToken, harvestAccountId, queryParams);
}


// --- Forecast API Functions ---

/**
 * Generic Forecast GET request.
 * @param {string} endpoint The API endpoint (e.g., 'people', 'assignments').
 * @param {string} forecastAccessToken Your Harvest Personal Access Token (used for Forecast as well).
 * @param {string} forecastAccountId Your Forecast Account ID.
 * @param {Object} [queryParams={}] Additional query parameters.
 * @returns {Promise<Array>} A promise that resolves to an array of fetched items.
 */
async function getForecast(endpoint, forecastAccessToken, forecastAccountId, queryParams = {}) {
    const headers = getApiHeaders("Forecast", forecastAccessToken, forecastAccountId);
    const url = `${FORECAST_API_URL}${endpoint}`;

    // Add default date range for Forecast if not provided, replicating Python logic
    if (!queryParams.start_date && !queryParams.end_date) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 31); // Last 31 days

        queryParams.start_date = startDate.toISOString().split('T')[0];
        queryParams.end_date = endDate.toISOString().split('T')[0];
    }
    // Forecast endpoints usually match the data key, pluralized
    const dataKey = endpoint;
    return fetchData(url, headers, queryParams, dataKey);
}


/**
 * Fetches all people (users) from Forecast.
 * @param {string} forecastAccessToken Your Harvest Personal Access Token (used for Forecast).
 * @param {string} forecastAccountId Your Forecast Account ID.
 * @returns {Promise<Array>} A promise that resolves to an array of Forecast person objects.
 */
export async function getForecastPeople(forecastAccessToken, forecastAccountId) {
    return getForecast("people", forecastAccessToken, forecastAccountId);
}

/**
 * Fetches assignments (allocations) from Forecast.
 * @param {string} forecastAccessToken Your Harvest Personal Access Token (used for Forecast).
 * @param {string} forecastAccountId Your Forecast Account ID.
 * @param {string} [startDate] YYYY-MM-DD start date. Defaults to 31 days ago.
 * @param {string} [endDate] YYYY-MM-DD end date. Defaults to today.
 * @returns {Promise<Array>} A promise that resolves to an array of Forecast assignment objects.
 */
export async function getForecastAssignments(forecastAccessToken, forecastAccountId, startDate, endDate) {
    const queryParams = {};
    if (startDate) queryParams.start_date = startDate;
    if (endDate) queryParams.end_date = endDate;
    return getForecast("assignments", forecastAccessToken, forecastAccountId, queryParams);
}
