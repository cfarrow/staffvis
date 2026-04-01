
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

/**
 * Fetches project allocations from Forecast and logged time from Harvest for the previous week,
 * then combines and outputs the data for each person-project combination. (Monday-Sunday)
 *
 * @param {string} harvestAccessToken Your Harvest Personal Access Token (used for both Harvest and Forecast).
 * @param {string} harvestAccountId Your Harvest Account ID.
 * @param {string} forecastAccountId Your Forecast Account ID.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of objects,
 *   each containing { personName, projectName, allocatedHours, loggedHours }.
 */
export async function getCombinedAllocationsAndLoggedTime(
    harvestAccessToken,
    harvestAccountId,
    forecastAccountId
) {
    if (!harvestAccessToken) {
        throw new Error("Missing HARVEST_ACCESS_TOKEN.");
    }
    if (!harvestAccountId) {
        throw new Error("Missing HARVEST_ACCOUNT_ID.");
    }
    if (!forecastAccountId) {
        throw new Error("Missing FORECAST_ACCOUNT_ID.");
    }

    // Calculate dates for the previous full week (Monday-Sunday)
    const currentDate = new Date();
    const dayOfWeek = currentDate.getDay(); // 0 for Sunday, 1 for Monday...

    // Adjust `currentDate` to be the end of the previous week (last Sunday)
    const daysToSubtractForLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
    const lastSundayDate = new Date(currentDate);
    lastSundayDate.setDate(currentDate.getDate() - daysToSubtractForLastSunday);
    lastSundayDate.setHours(0, 0, 0, 0); // Normalize to start of day

    const mondayOfPreviousWeekDate = new Date(lastSundayDate);
    mondayOfPreviousWeekDate.setDate(lastSundayDate.getDate() - 6);
    mondayOfPreviousWeekDate.setHours(0, 0, 0, 0); // Normalize to start of day

    const fromDate = mondayOfPreviousWeekDate.toISOString().split('T')[0];
    const toDate = lastSundayDate.toISOString().split('T')[0];

    console.log(`Fetching data for previous week: ${fromDate} to ${toDate}`);

    // --- Fetch all necessary data concurrently ---
    // Note: Forecast API also uses the Harvest Personal Access Token.
    const [
        harvestUsers,
        harvestProjects,
        harvestTimeEntries,
        forecastPeople,
        forecastProjects,
        forecastAssignments,
    ] = await Promise.all([
        getHarvestUsers(harvestAccessToken, harvestAccountId),
        getHarvestProjects(harvestAccessToken, harvestAccountId),
        getHarvestTimeEntries(harvestAccessToken, harvestAccountId, fromDate, toDate),
        getForecastPeople(harvestAccessToken, forecastAccountId),
        // Assuming Forecast has a /projects endpoint to retrieve project names by ID.
        getForecast("projects", harvestAccessToken, forecastAccountId),
        getForecastAssignments(harvestAccessToken, forecastAccountId, fromDate, toDate),
    ]);

    // --- Create Lookup Maps for names by ID ---
    const harvestUsersMap = new Map(harvestUsers.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()]));
    const harvestProjectsMap = new Map(harvestProjects.map(p => [p.id, p.name]));
    const forecastPeopleMap = new Map(forecastPeople.map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()]));
    const forecastProjectsMap = new Map(forecastProjects.map(p => [p.id, p.name]));

    // A map to store combined results: "personName||projectName" -> { personName, projectName, allocatedHours, loggedHours }
    const combinedData = new Map();

    const getCombinedKey = (personName, projectName) => `${personName}||${projectName}`;

    const getOrCreateEntry = (personName, projectName) => {
        const key = getCombinedKey(personName, projectName);
        if (!combinedData.has(key)) {
            combinedData.set(key, { personName, projectName, allocatedHours: 0, loggedHours: 0 });
        }
        return combinedData.get(key);
    };

    // --- Process Forecast Allocations ---
    for (const assignment of forecastAssignments) {
        const personName = forecastPeopleMap.get(assignment.person_id);
        const projectName = forecastProjectsMap.get(assignment.project_id); // Use Forecast's project name

        if (personName && projectName) {
            const entry = getOrCreateEntry(personName, projectName);
            // Forecast allocation is in seconds, convert to hours
            entry.allocatedHours += (assignment.allocation || 0) / 3600;
        } else {
            // console.warn(`Skipping Forecast assignment due to missing person or project name:`, assignment);
        }
    }

    // --- Process Harvest Time Entries ---
    for (const timeEntry of harvestTimeEntries) {
        const personName = harvestUsersMap.get(timeEntry.user.id);
        const projectName = harvestProjectsMap.get(timeEntry.project.id); // Use Harvest's project name

        if (personName && projectName) {
            const entry = getOrCreateEntry(personName, projectName);
            entry.loggedHours += (timeEntry.hours || 0);
        } else {
            // console.warn(`Skipping Harvest time entry due to missing person or project name:`, timeEntry);
        }
    }

    // --- Filter and Return Results ---
    const finalResults = Array.from(combinedData.values()).filter(
        entry => entry.allocatedHours > 0 || entry.loggedHours > 0
    );

    return finalResults;
}
