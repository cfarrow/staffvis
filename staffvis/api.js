
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
    forecastAccountId,
    startDate = null, // New parameter for custom start date
    endDate = null    // New parameter for custom end date
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

    let fromDate, toDate;

    // Determine the date range
    if (startDate && endDate) {
        fromDate = startDate;
        toDate = endDate;
    } else {
        // Default to the previous full week (Monday-Sunday)
        const currentDate = new Date();
        const dayOfWeek = currentDate.getDay(); // 0 for Sunday, 1 for Monday...

        // Calculate last Sunday (end of the previous week)
        // If today is Sunday, subtract 7 days to get last Sunday. Otherwise, subtract `dayOfWeek` days.
        const daysToSubtractForLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
        const lastSundayDate = new Date(currentDate);
        lastSundayDate.setDate(currentDate.getDate() - daysToSubtractForLastSunday);
        lastSundayDate.setHours(0, 0, 0, 0); // Normalize to start of day

        // Calculate Monday of the previous week
        const mondayOfPreviousWeekDate = new Date(lastSundayDate);
        mondayOfPreviousWeekDate.setDate(lastSundayDate.getDate() - 6);
        mondayOfPreviousWeekDate.setHours(0, 0, 0, 0); // Normalize to start of day

        fromDate = mondayOfPreviousWeekDate.toISOString().split('T')[0];
        toDate = lastSundayDate.toISOString().split('T')[0];
    }

    console.log(`Fetching data for range: ${fromDate} to ${toDate}`);

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
    // Assuming forecastAssignments contains daily allocation records within the specified range.
    // The loop inherently sums these daily allocations over the entire period.
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

/**
 * Formats the combined allocation and logged time data into nodes and edges suitable for vis.Network.
 * Each person and project becomes a node, and each allocation/logged time combination becomes an edge.
 * Labels are formatted with aggregated logged and allocated hours, with styling based on comparison.
 *
 * @param {Array<Object>} combinedData - The output from getCombinedAllocationsAndLoggedTime.
 *   Each object: { personName, projectName, allocatedHours, loggedHours }.
 * @returns {{nodes: Array<Object>, edges: Array<Object>}} An object containing arrays of formatted nodes and edges.
 */
export function formatCombinedDataForNetwork(combinedData) {
  const nodesMap = new Map(); // Key: 'personName' or 'projectName', Value: { id, name, type, totalLogged, totalAllocated }
  const edges = [];

  let nextNodeId = 1;

  // Helper to get or create a node in the map and assign an ID
  const getOrCreateNode = (name, type) => {
    let node = nodesMap.get(name);
    if (!node) {
      node = { id: nextNodeId++, name: name, type: type, totalLogged: 0, totalAllocated: 0 };
      nodesMap.set(name, node);
    }
    return node;
  };

  // First pass: Aggregate data for nodes and prepare node objects
  for (const entry of combinedData) {
    if (entry.personName && entry.projectName) {
      const personNode = getOrCreateNode(entry.personName, 'person');
      personNode.totalLogged += entry.loggedHours;
      personNode.totalAllocated += entry.allocatedHours;

      const projectNode = getOrCreateNode(entry.projectName, 'project');
      projectNode.totalLogged += entry.loggedHours;
      projectNode.totalAllocated += entry.allocatedHours;
    }
  }

  const formattedNodes = [];
  // Second pass: Create formatted nodes with labels
  for (const [name, nodeData] of nodesMap.entries()) {
    const loggedTime = nodeData.totalLogged;
    const allocatedTime = nodeData.totalAllocated;

    let loggedHtml;
    if (loggedTime < allocatedTime) {
      loggedHtml = `<b>${loggedTime.toFixed(1)}</b>`;
    } else {
      loggedHtml = `<i>${loggedTime.toFixed(1)}</i>`;
    }

    let allocatedHtml = allocatedTime.toFixed(1);

    // The label format: loggedTime\n\nName\n\nallocatedTime
    const label = `${loggedHtml}\n\n${nodeData.name}\n\n${allocatedHtml}`;

    // Assign level based on type for hierarchical layout
    const level = nodeData.type === 'person' ? 0 : 1;

    formattedNodes.push({
      id: nodeData.id,
      label: label,
      type: nodeData.type, // Custom attribute to easily identify node type
      level: level
    });
  }

  // Third pass: Create edges
  for (const entry of combinedData) {
    const personNode = nodesMap.get(entry.personName);
    const projectNode = nodesMap.get(entry.projectName);

    if (personNode && projectNode) {
      const loggedTime = entry.loggedHours;
      const allocatedTime = entry.allocatedHours;

      let loggedHtml;
      if (loggedTime < allocatedTime) {
        loggedHtml = `<b>${loggedTime.toFixed(1)}</b>`;
      } else {
        loggedHtml = `<i>${loggedTime.toFixed(1)}</i>`;
      }

      let allocatedHtml = allocatedTime.toFixed(1);

      // The edge label format: loggedTime\n\nallocatedTime
      const edgeLabel = `${loggedHtml}\n\n${allocatedHtml}`;

      edges.push({
        from: personNode.id,
        to: projectNode.id,
        label: edgeLabel
      });
    }
  }

  return { nodes: formattedNodes, edges: edges };
}
