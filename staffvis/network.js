
// Base options for each node
const nodeopts = {
  shape: "box",
  color: "#f0f0f0",
  font: { multi: true }
}
const edgeopts = {
  font: { multi: true }
}
// Using a bipartite graph, persons on the left and projects on the right.
const personNodeDefaults = { ...nodeopts, level: 0 }
const projectNodeDefaults = { ...nodeopts, level: 1 }

// Options for the plot. We can adjust the fonts within a given label
// by adjusting the bold, italic, boldital, and mono fonts.
const fontopts = {
  bold: {
    color: '#ef004c' // Bold is red bold
  },
  ital: {
    color: '#00b000',
    mod: 'bold'  // Italic is green bold
  }
}

// Global variables for vis.js data and network instance
let nodesDataSet;
let edgesDataSet;
let network;
let allPeopleNames = [];
let allProjectNames = [];

// Function to initialize the multi-select dropdowns
function initializeSelectors() {
    const personSelector = document.getElementById('person-selector');
    const projectSelector = document.getElementById('project-selector');

    // Populate person selector
    allPeopleNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.selected = true; // Select all by default
        personSelector.appendChild(option);
    });

    // Populate project selector
    allProjectNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.selected = true; // Select all by default
        projectSelector.appendChild(option);
    });

    // Add event listeners
    personSelector.addEventListener('change', filterNetwork);
    projectSelector.addEventListener('change', filterNetwork);
}

// Function to filter the network based on selected items in the dropdowns
function filterNetwork() {
    const personSelector = document.getElementById('person-selector');
    const projectSelector = document.getElementById('project-selector');

    const selectedPeople = Array.from(personSelector.selectedOptions).map(option => option.value);
    const selectedProjects = Array.from(projectSelector.selectedOptions).map(option => option.value);

    // If no people/projects are explicitly selected, treat all as selected
    const allPeopleSelected = selectedPeople.length === 0;
    const allProjectsSelected = selectedProjects.length === 0;

    const updatedNodes = [];
    const updatedEdges = [];

    // Determine visible nodes
    // This variable is declared once per function call.
    const visibleNodeIds = new Set();

    // Map node names to their IDs for quick lookup
    const nodeNameToIdMap = new Map();
    nodesDataSet.forEach(node => {
        // Extract the name from the label: "logged\n\nName\n\nallocated"
        const nameMatch = node.label.match(/\n\n(.*?)\n\n/);
        if (nameMatch && nameMatch[1]) {
            nodeNameToIdMap.set(nameMatch[1], node.id);
        }
    });

    // Infer connections from edges to determine which people are linked to which projects.
    const personToProjectsMap = new Map();
    const projectToPeopleMap = new Map();

    edgesDataSet.forEach(edge => {
        const fromNode = nodesDataSet.get(edge.from);
        const toNode = nodesDataSet.get(edge.to);

        if (!fromNode || !toNode) return; // Safety check

        let personNode, projectNode;
        if (fromNode.type === 'person' && toNode.type === 'project') {
            personNode = fromNode;
            projectNode = toNode;
        } else if (fromNode.type === 'project' && toNode.type === 'person') {
            personNode = toNode;
            projectNode = fromNode;
        } else {
            return; // Not a person-project connection
        }

        const personNameMatch = personNode.label.match(/\n\n(.*?)\n\n/);
        const projectNameMatch = projectNode.label.match(/\n\n(.*?)\n\n/);

        if (personNameMatch && personNameMatch[1] && projectNameMatch && projectNameMatch[1]) {
            const personName = personNameMatch[1];
            const projectName = projectNameMatch[1];

            if (!personToProjectsMap.has(personName)) {
                personToProjectsMap.set(personName, new Set());
            }
            personToProjectsMap.get(personName).add(projectName);

            if (!projectToPeopleMap.has(projectName)) {
                projectToPeopleMap.set(projectName, new Set());
            }
            projectToPeopleMap.get(projectName).add(personName);
        }
    });

    // Determine visible nodes based on selections and inferred connections
    // Add selected people and their connected projects
    selectedPeople.forEach(personName => {
        const personId = nodeNameToIdMap.get(personName);
        if (personId !== undefined) visibleNodeIds.add(personId);

        if (personToProjectsMap.has(personName)) {
            personToProjectsMap.get(personName).forEach(projectName => {
                const projectId = nodeNameToIdMap.get(projectName);
                if (projectId !== undefined) visibleNodeIds.add(projectId);
            });
        }
    });

    // Add selected projects and their connected people
    selectedProjects.forEach(projectName => {
        const projectId = nodeNameToIdMap.get(projectName);
        if (projectId !== undefined) visibleNodeIds.add(projectId);

        if (projectToPeopleMap.has(projectName)) {
            projectToPeopleMap.get(projectName).forEach(personName => {
                const personId = nodeNameToIdMap.get(personName);
                if (personId !== undefined) visibleNodeIds.add(personId);
            });
        }
    });

    // If all people and projects are implicitly selected (no filters applied or all selected), all nodes should be visible.
    if (allPeopleSelected && allProjectsSelected) {
        nodesDataSet.forEach(node => {
            visibleNodeIds.add(node.id);
        });
    }

    // Update nodes: mark visible or hidden
    nodesDataSet.forEach(node => {
        const isVisible = visibleNodeIds.has(node.id);
        updatedNodes.push({ id: node.id, hidden: !isVisible });
    });
    nodesDataSet.update(updatedNodes);

    // Update edges: mark visible or hidden based on connected nodes visibility
    edgesDataSet.forEach(edge => {
        const fromNodeVisible = visibleNodeIds.has(edge.from);
        const toNodeVisible = visibleNodeIds.has(edge.to);
        // An edge is visible only if both its connected nodes are visible
        const isVisible = fromNodeVisible && toNodeVisible;
        updatedEdges.push({ id: edge.id, hidden: !isVisible });
    });
    edgesDataSet.update(updatedEdges);

    // Stabilize the network after updating visibility
    network.stabilize(10); // Run 10 iterations to quickly adjust
}


// Main execution block
(async () => {
  try {
    let jsonData;
    // In a browser environment, you would typically fetch data from a file like this:
    try {
        const response = await fetch('./data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        jsonData = await response.json();
    } catch (fetchError) {
        // If fetch fails (as it will in this simulated environment),
        // we fall back to using the pre-read content of data.json.
        console.warn('Fetch failed, falling back to embedded data:', fetchError);

        // The content of data.json, read previously by the tool.
        const embeddedJsonDataContent = `
{
  "nodes": [
    { "id": 1, "label": "<i>34.0</i>\n\nAlice Smith\n\n6.0", "type": "person", "level": 0 },
    { "id": 2, "label": "<i>322.5</i>\n\nApple\n\n55.2", "type": "project", "level": 1 },
    { "id": 3, "label": "<i>37.8</i>\n\nBob Johnson\n\n8.8", "type": "person", "level": 0 },
    { "id": 4, "label": "<b>0.0</b>\n\nBanana\n\n0.8", "type": "project", "level": 1 },
    { "id": 5, "label": "<i>38.0</i>\n\nCarol White\n\n7.2", "type": "person", "level": 0 },
    { "id": 6, "label": "<i>81.3</i>\n\nCherry\n\n18.4", "type": "project", "level": 1 },
    { "id": 7, "label": "<b>0.0</b>\n\nDate\n\n0.0", "type": "project", "level": 1 },
    { "id": 8, "label": "<i>15.8</i>\n\nDavid Green\n\n3.0", "type": "person", "level": 0 },
    { "id": 9, "label": "<i>56.0</i>\n\nElderberry\n\n4.0", "type": "project", "level": 1 },
    { "id": 10, "label": "<b>0.0</b>\n\nFig\n\n2.8", "type": "project", "level": 1 },
    { "id": 11, "label": "<i>40.0</i>\n\nEve Black\n\n7.2", "type": "person", "level": 0 },
    { "id": 12, "label": "<i>199.8</i>\n\nGrape\n\n50.6", "type": "project", "level": 1 },
    { "id": 13, "label": "<i>40.3</i>\n\nFrank Brown\n\n7.5", "type": "person", "level": 0 },
    { "id": 14, "label": "<b>0.0</b>\n\nGrace Davis\n\n8.0", "type": "person", "level": 0 },
    { "id": 15, "label": "<i>26.0</i>\n\nHenry Wilson\n\n5.2", "type": "person", "level": 0 },
    { "id": 16, "label": "<i>39.5</i>\n\nIvy Moore\n\n8.0", "type": "person", "level": 0 },
    { "id": 17, "label": "<b>0.0</b>\n\nHoneydew\n\n3.4", "type": "project", "level": 1 },
    { "id": 18, "label": "<i>36.0</i>\n\nJack Taylor\n\n7.2", "type": "person", "level": 0 },
    { "id": 19, "label": "<i>54.5</i>\n\nIndian Fig\n\n10.6", "type": "project", "level": 1 },
    { "id": 20, "label": "<i>20.3</i>\n\nJackfruit\n\n1.4", "type": "project", "level": 1 },
    { "id": 21, "label": "<i>32.0</i>\n\nKate Miller\n\n6.4", "type": "person", "level": 0 },
    { "id": 22, "label": "<b>0.0</b>\n\nKumquat\n\n0.0", "type": "project", "level": 1 },
    { "id": 23, "label": "<i>12.3</i>\n\nLemon\n\n1.3", "type": "project", "level": 1 },
    { "id": 24, "label": "<i>49.0</i>\n\nLiam Anderson\n\n7.2", "type": "person", "level": 0 },
    { "id": 25, "label": "<b>0.0</b>\n\nMango\n\n0.0", "type": "project", "level": 1 },
    { "id": 26, "label": "<i>28.5</i>\n\nNectarine\n\n2.0", "type": "project", "level": 1 },
    { "id": 27, "label": "<i>39.3</i>\n\nMia Thomas\n\n7.2", "type": "person", "level": 0 },
    { "id": 28, "label": "<i>13.8</i>\n\nOrange\n\n2.0", "type": "project", "level": 1 },
    { "id": 29, "label": "<i>36.0</i>\n\nNoah Jackson\n\n7.2", "type": "person", "level": 0 },
    { "id": 30, "label": "<i>40.0</i>\n\nOlivia Harris\n\n7.2", "type": "person", "level": 0 },
    { "id": 31, "label": "<b>0.0</b>\n\nPeter Clark\n\n0.5", "type": "person", "level": 0 },
    { "id": 32, "label": "<i>21.8</i>\n\nPapaya\n\n8.0", "type": "project", "level": 1 },
    { "id": 33, "label": "<i>21.0</i>\n\nQuinn Lewis\n\n5.0", "type": "person", "level": 0 },
    { "id": 34, "label": "<b>0.0</b>\n\nRachel King\n\n2.0", "type": "person", "level": 0 },
    { "id": 35, "label": "<i>30.0</i>\n\nSam Wright\n\n0.5", "type": "person", "level": 0 },
    { "id": 36, "label": "<i>35.8</i>\n\nTina Hall\n\n7.2", "type": "person", "level": 0 },
    { "id": 37, "label": "<i>37.3</i>\n\nUma Scott\n\n7.2", "type": "person", "level": 0 },
    { "id": 38, "label": "<i>0.5</i>\n\nQuince\n\n0.0", "type": "project", "level": 1 },
    { "id": 39, "label": "<i>36.0</i>\n\nVictor Adams\n\n7.5", "type": "person", "level": 0 },
    { "id": 40, "label": "<i>36.8</i>\n\nWendy Baker\n\n7.2", "type": "person", "level": 0 },
    { "id": 41, "label": "<i>39.0</i>\n\nXena Turner\n\n7.2", "type": "person", "level": 0 },
    { "id": 42, "label": "<i>36.0</i>\n\nYash Walker\n\n10.4", "type": "person", "level": 0 },
    { "id": 43, "label": "<i>11.5</i>\n\nRaspberry\n\n3.8", "type": "project", "level": 1 },
    { "id": 44, "label": "<i>40.0</i>\n\nZoe Young\n\n7.2", "type": "person", "level": 0 },
    { "id": 45, "label": "<i>19.0</i>\n\nAdam Carter\n\n7.2", "type": "person", "level": 0 },
    { "id": 46, "label": "<i>6.3</i>\n\nStrawberry\n\n2.0", "type": "project", "level": 1 },
    { "id": 47, "label": "<i>36.5</i>\n\nBella Perez\n\n10.4", "type": "person", "level": 0 },
    { "id": 48, "label": "<b>0.0</b>\n\nTangerine\n\n3.2", "type": "project", "level": 1 },
    { "id": 49, "label": "<i>27.8</i>\n\nUgli Fruit\n\n8.0", "type": "project", "level": 1 },
    { "id": 50, "label": "<i>58.8</i>\n\nVanilla Bean\n\n10.5", "type": "project", "level": 1 },
    { "id": 51, "label": "<i>5.8</i>\n\nWatermelon\n\n0.8", "type": "project", "level": 1 },
    { "id": 52, "label": "<i>40.8</i>\n\nChris Evans\n\n7.2", "type": "person", "level": 0 },
    { "id": 53, "label": "<i>36.0</i>\n\nDiana Rodriguez\n\n7.2", "type": "person", "level": 0 },
    { "id": 54, "label": "<i>36.0</i>\n\nEthan Martinez\n\n7.2", "type": "person", "level": 0 },
    { "id": 55, "label": "<i>6.0</i>\n\nXigua\n\n1.2", "type": "project", "level": 1 },
    { "id": 56, "label": "<i>36.0</i>\n\nFiona Hernandez\n\n8.0", "type": "person", "level": 0 },
    { "id": 57, "label": "<i>28.0</i>\n\nYellow Passion Fruit\n\n4.4", "type": "project", "level": 1 },
    { "id": 58, "label": "<i>36.0</i>\n\nGeorge Lee\n\n7.2", "type": "person", "level": 0 },
    { "id": 59, "label": "<i>20.0</i>\n\nZucchini\n\n4.0", "type": "project", "level": 1 },
    { "id": 60, "label": "<i>18.0</i>\n\nHannah Garcia\n\n4.0", "type": "person", "level": 0 },
    { "id": 61, "label": "<b>0.0</b>\n\nApricot\n\n0.8", "type": "project", "level": 1 },
    { "id": 62, "label": "<i>40.0</i>\n\nIsaac Kim\n\n7.2", "type": "person", "level": 0 },
    { "id": 63, "label": "<i>192.8</i>\n\nBlackberry\n\n7.2", "type": "project", "level": 1 },
    { "id": 64, "label": "<i>40.0</i>\n\nJulia Chen\n\n7.2", "type": "person", "level": 0 },
    { "id": 65, "label": "<b>2.8</b>\n\nCranberry\n\n3.6", "type": "project", "level": 1 },
    { "id": 66, "label": "<i>40.0</i>\n\nKevin Green\n\n7.2", "type": "person", "level": 0 },
    { "id": 67, "label": "<i>40.0</i>\n\nDurian\n\n7.4", "type": "project", "level": 1 },
    { "id": 68, "label": "<i>72.0</i>\n\nEggplant\n\n13.4", "type": "project", "level": 1 },
    { "id": 69, "label": "<i>40.0</i>\n\nLily Hall\n\n7.2", "type": "person", "level": 0 },
    { "id": 70, "label": "<i>40.0</i>\n\nFeijoa\n\n7.2", "type": "project", "level": 1 },
    { "id": 71, "label": "<i>37.5</i>\n\nMike Davis\n\n14.4", "type": "person", "level": 0 },
    { "id": 72, "label": "<b>0.0</b>\n\nGuava\n\n7.2", "type": "project", "level": 1 },
    { "id": 73, "label": "<i>84.8</i>\n\nHuckleberry\n\n21.4", "type": "project", "level": 1 },
    { "id": 74, "label": "<i>37.0</i>\n\nNina Brown\n\n7.2", "type": "person", "level": 0 },
    { "id": 75, "label": "<i>29.3</i>\n\nImbe\n\n5.6", "type": "project", "level": 1 },
    { "id": 76, "label": "<i>1.0</i>\n\nJava Plum\n\n0.2", "type": "project", "level": 1 },
    { "id": 77, "label": "<i>71.8</i>\n\nKiwi\n\n4.0", "type": "project", "level": 1 },
    { "id": 78, "label": "<i>40.0</i>\n\nOliver White\n\n7.2", "type": "person", "level": 0 },
    { "id": 79, "label": "<i>63.0</i>\n\nPenny Johnson\n\n7.2", "type": "person", "level": 0 },
    { "id": 80, "label": "<i>43.0</i>\n\nRobert Smith\n\n1.6", "type": "person", "level": 0 },
    { "id": 81, "label": "<i>131.3</i>\n\nLychee\n\n20.2", "type": "project", "level": 1 },
    { "id": 82, "label": "<i>40.0</i>\n\nErik Postma\n\n7.2", "type": "person", "level": 0 },
    { "id": 83, "label": "<i>40.0</i>\n\nBrandon Geraci\n\n7.2", "type": "person", "level": 0 },
    { "id": 84, "label": "<i>36.8</i>\n\nLychee\n\n29.4", "type": "project", "level": 1 },
    { "id": 85, "label": "<i>30.0</i>\n\nSarah Miller\n\n7.2", "type": "person", "level": 0 },
    { "id": 86, "label": "<i>37.3</i>\n\nTom Jones\n\n7.2", "type": "person", "level": 0 },
    { "id": 87, "label": "<i>56.0</i>\n\nVicky Williams\n\n7.2", "type": "person", "level": 0 },
    { "id": 88, "label": "<i>32.0</i>\n\nWalter Clark\n\n0.0", "type": "person", "level": 0 },
    { "id": 89, "label": "<i>32.0</i>\n\nMulberry\n\n0.0", "type": "project", "level": 1 },
    { "id": 90, "label": "<i>40.0</i>\n\nYvonne Green\n\n0.0", "type": "person", "level": 0 },
    { "id": 91, "label": "<i>18.0</i>\n\nZach Taylor\n\n0.0", "type": "person", "level": 0 },
    { "id": 92, "label": "<i>131.0</i>\n\nOlive\n\n0.0", "type": "project", "level": 1 },
    { "id": 93, "label": "<i>40.0</i>\n\nAbigail King\n\n0.0", "type": "person", "level": 0 },
    { "id": 94, "label": "<i>111.5</i>\n\nPeach\n\n0.0", "type": "project", "level": 1 },
    { "id": 95, "label": "<i>40.3</i>\n\nBenjamin Lee\n\n0.0", "type": "person", "level": 0 },
    { "id": 96, "label": "<i>16.0</i>\n\nCharlotte Hall\n\n0.0", "type": "person", "level": 0 },
    { "id": 97, "label": "<i>16.0</i>\n\nPersimmon\n\n0.0", "type": "project", "level": 1 },
    { "id": 98, "label": "<i>40.0</i>\n\nDaniel Garcia\n\n0.0", "type": "person", "level": 0 },
    { "id": 99, "label": "<i>40.0</i>\n\nPineapple\n\n0.0", "type": "project", "level": 1 },
    { "id": 100, "label": "<i>12.5</i>\n\nPlum\n\n0.0", "type": "project", "level": 1 },
    { "id": 101, "label": "<i>5.5</i>\n\nEmily Brown\n\n0.0", "type": "person", "level": 0 },
    { "id": 102, "label": "<i>36.3</i>\n\nFred White\n\n0.0", "type": "person", "level": 0 },
    { "id": 103, "label": "<i>41.0</i>\n\nGina Harris\n\n0.0", "type": "person", "level": 0 },
    { "id": 104, "label": "<i>42.3</i>\n\nHarry Davis\n\n0.0", "type": "person", "level": 0 },
    { "id": 105, "label": "<i>40.0</i>\n\nIrene Wilson\n\n0.0", "type": "person", "level": 0 },
    { "id": 106, "label": "<i>2.0</i>\n\nRambutan\n\n0.0", "type": "project", "level": 1 },
    { "id": 107, "label": "<i>5.0</i>\n\nJohn Moore\n\n0.0", "type": "person", "level": 0 },
    { "id": 108, "label": "<i>5.0</i>\n\nSalak\n\n0.0", "type": "project", "level": 1 },
    { "id": 109, "label": "<i>2.5</i>\n\nSapodilla\n\n0.0", "type": "project", "level": 1 },
    { "id": 110, "label": "<i>23.8</i>\n\nTamarind\n\n0.0", "type": "project", "level": 1 }
  ],
  "edges": [
    { "from": 1, "to": 2, "label": "<i>21.0</i>\n\n3.6" },
    { "from": 3, "to": 4, "label": "<b>0.0</b>\n\n0.8" },
    { "from": 5, "to": 6, "label": "<i>22.0</i>\n\n7.2" },
    { "from": 3, "to": 7, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 8, "to": 9, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 3, "to": 10, "label": "<b>0.0</b>\n\n1.6" },
    { "from": 11, "to": 12, "label": "<i>40.0</i>\n\n7.2" },
    { "from": 13, "to": 12, "label": "<i>39.3</i>\n\n6.9" },
    { "from": 14, "to": 12, "label": "<b>0.0</b>\n\n8.0" },
    { "from": 15, "to": 12, "label": "<i>26.0</i>\n\n5.2" },
    { "from": 16, "to": 17, "label": "<b>0.0</b>\n\n0.2" },
    { "from": 18, "to": 19, "label": "<i>36.0</i>\n\n7.2" },
    { "from": 16, "to": 10, "label": "<b>0.0</b>\n\n0.6" },
    { "from": 13, "to": 10, "label": "<b>0.0</b>\n\n0.3" },
    { "from": 1, "to": 20, "label": "<i>3.5</i>\n\n0.4" },
    { "from": 21, "to": 20, "label": "<i>3.0</i>\n\n0.2" },
    { "from": 3, "to": 22, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 13, "to": 23, "label": "<i>1.0</i>\n\n0.0" },
    { "from": 24, "to": 6, "label": "<i>22.3</i>\n\n4.0" },
    { "from": 1, "to": 4, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 1, "to": 25, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 1, "to": 26, "label": "<i>6.0</i>\n\n2.0" },
    { "from": 27, "to": 28, "label": "<i>13.8</i>\n\n2.0" },
    { "from": 27, "to": 9, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 29, "to": 6, "label": "<i>36.0</i>\n\n7.2" },
    { "from": 30, "to": 20, "label": "<i>2.0</i>\n\n0.4" },
    { "from": 31, "to": 32, "label": "<b>0.0</b>\n\n0.5" },
    { "from": 33, "to": 32, "label": "<i>21.0</i>\n\n5.0" },
    { "from": 34, "to": 32, "label": "<b>0.0</b>\n\n2.0" },
    { "from": 35, "to": 32, "label": "<i>0.8</i>\n\n0.5" },
    { "from": 30, "to": 2, "label": "<i>35.5</i>\n\n6.8" },
    { "from": 36, "to": 12, "label": "<i>35.8</i>\n\n7.2" },
    { "from": 37, "to": 38, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 39, "to": 12, "label": "<i>11.5</i>\n\n6.9" },
    { "from": 39, "to": 10, "label": "<b>0.0</b>\n\n0.3" },
    { "from": 40, "to": 10, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 41, "to": 2, "label": "<i>39.0</i>\n\n7.2" },
    { "from": 42, "to": 17, "label": "<b>0.0</b>\n\n3.2" },
    { "from": 3, "to": 43, "label": "<i>2.0</i>\n\n0.6" },
    { "from": 39, "to": 43, "label": "<b>0.0</b>\n\n0.3" },
    { "from": 13, "to": 43, "label": "<b>0.0</b>\n\n0.3" },
    { "from": 44, "to": 12, "label": "<b>2.0</b>\n\n3.6" },
    { "from": 45, "to": 2, "label": "<i>14.0</i>\n\n5.2" },
    { "from": 45, "to": 46, "label": "<i>5.0</i>\n\n2.0" },
    { "from": 47, "to": 48, "label": "<b>0.0</b>\n\n3.2" },
    { "from": 27, "to": 49, "label": "<i>7.5</i>\n\n2.4" },
    { "from": 27, "to": 23, "label": "<i>8.8</i>\n\n0.4" },
    { "from": 27, "to": 50, "label": "<i>8.3</i>\n\n2.4" },
    { "from": 8, "to": 23, "label": "<i>1.0</i>\n\n0.2" },
    { "from": 8, "to": 50, "label": "<i>11.0</i>\n\n2.0" },
    { "from": 30, "to": 51, "label": "<i>0.5</i>\n\n0.0" },
    { "from": 24, "to": 20, "label": "<i>3.0</i>\n\n0.2" },
    { "from": 52, "to": 20, "label": "<b>0.0</b>\n\n0.2" },
    { "from": 53, "to": 2, "label": "<i>13.8</i>\n\n4.0" },
    { "from": 53, "to": 19, "label": "<i>18.5</i>\n\n3.2" },
    { "from": 54, "to": 55, "label": "<i>6.0</i>\n\n1.2" },
    { "from": 56, "to": 9, "label": "<b>0.0</b>\n\n4.0" },
    { "from": 56, "to": 2, "label": "<i>24.0</i>\n\n4.0" },
    { "from": 42, "to": 57, "label": "<i>23.0</i>\n\n3.6" },
    { "from": 42, "to": 49, "label": "<i>13.0</i>\n\n3.6" },
    { "from": 58, "to": 59, "label": "<i>20.0</i>\n\n4.0" },
    { "from": 60, "to": 2, "label": "<i>18.0</i>\n\n3.2" },
    { "from": 60, "to": 61, "label": "<b>0.0</b>\n\n0.8" },
    { "from": 62, "to": 63, "label": "<i>40.0</i>\n\n7.2" },
    { "from": 64, "to": 23, "label": "<b>0.0</b>\n\n0.7" },
    { "from": 40, "to": 65, "label": "<b>2.5</b>\n\n3.6" },
    { "from": 40, "to": 12, "label": "<i>34.3</i>\n\n3.6" },
    { "from": 64, "to": 49, "label": "<i>0.5</i>\n\n0.4" },
    { "from": 64, "to": 50, "label": "<i>39.5</i>\n\n6.1" },
    { "from": 66, "to": 67, "label": "<i>40.0</i>\n\n7.2" },
    { "from": 8, "to": 49, "label": "<i>3.8</i>\n\n0.8" },
    { "from": 37, "to": 49, "label": "<i>1.8</i>\n\n0.8" },
    { "from": 37, "to": 68, "label": "<i>34.5</i>\n\n6.4" },
    { "from": 69, "to": 70, "label": "<i>40.0</i>\n\n7.2" },
    { "from": 71, "to": 72, "label": "<b>0.0</b>\n\n7.2" },
    { "from": 21, "to": 73, "label": "<i>21.0</i>\n\n6.2" },
    { "from": 74, "to": 75, "label": "<i>29.0</i>\n\n5.6" },
    { "from": 16, "to": 57, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 16, "to": 68, "label": "<b>0.0</b>\n\n0.0" },
    { "from": 16, "to": 19, "label": "<b>0.0</b>\n\n0.2" },
    { "from": 16, "to": 67, "label": "<b>0.0</b>\n\n0.2" },
    { "from": 16, "to": 12, "label": "<i>7.5</i>\n\n2.0" },
    { "from": 16, "to": 76, "label": "<i>1.0</i>\n\n0.2" },
    { "from": 47, "to": 77, "label": "<b>0.0</b>\n\n4.0" },
    { "from": 78, "to": 2, "label": "<i>12.0</i>\n\n3.2" },
    { "from": 79, "to": 57, "label": "<i>2.5</i>\n\n0.8" },
    { "from": 47, "to": 73, "label": "<i>7.5</i>\n\n3.2" },
    { "from": 71, "to": 73, "label": "<i>29.5</i>\n\n7.2" },
    { "from": 58, "to": 73, "label": "<i>13.3</i>\n\n3.2" },
    { "from": 54, "to": 2, "label": "<i>25.0</i>\n\n5.2" },
    { "from": 54, "to": 51, "label": "<i>5.0</i>\n\n0.8" },
    { "from": 80, "to": 81, "label": "<i>10.0</i>\n\n1.6" },
    { "from": 44, "to": 81, "label": "<i>38.0</i>\n\n3.6" },
    { "from": 3, "to": 81, "label": "<i>32.5</i>\n\n5.8" },
    { "from": 82, "to": 81, "label": "<i>38.8</i>\n\n7.2" },
    { "from": 16, "to": 81, "label": "<i>12.0</i>\n\n2.0" },
    { "from": 16, "to": 43, "label": "<i>9.5</i>\n\n2.6" },
    { "from": 83, "to": 2, "label": "<i>16.0</i>\n\n7.2" },
    { "from": 74, "to": 73, "label": "<i>8.0</i>\n\n1.6" },
    { "from": 3, "to": 12, "label": "<i>1.5</i>\n\n0.0" },
    { "from": 52, "to": 68, "label": "<i>33.8</i>\n\n7.0" },
    { "from": 79, "to": 84, "label": "<i>3.5</i>\n\n2.4" },
    { "from": 85, "to": 84, "label": "<i>10.0</i>\n\n5.6" },
    { "from": 85, "to": 2, "label": "<i>8.0</i>\n\n1.6" },
    { "from": 86, "to": 84, "label": "<i>11.3</i>\n\n7.2" },
    { "from": 87, "to": 84, "label": "<b>0.0</b>\n\n7.2" },
    { "from": 24, "to": 84, "label": "<b>0.0</b>\n\n3.0" },
    { "from": 78, "to": 84, "label": "<b>0.0</b>\n\n4.0" },
    { "from": 79, "to": 2, "label": "<i>54.5</i>\n\n4.0" },
    { "from": 87, "to": 9, "label": "<i>56.0</i>\n\n0.0" },
    { "from": 24, "to": 2, "label": "<i>2.3</i>\n\n0.0" },
    { "from": 88, "to": 89, "label": "<i>32.0</i>\n\n0.0" },
    { "from": 90, "to": 63, "label": "<i>8.0</i>\n\n0.0" },
    { "from": 1, "to": 73, "label": "<i>3.5</i>\n\n0.0" },
    { "from": 47, "to": 2, "label": "<i>29.0</i>\n\n0.0" },
    { "from": 56, "to": 84, "label": "<i>12.0</i>\n\n0.0" },
    { "from": 91, "to": 92, "label": "<i>18.0</i>\n\n0.0" },
    { "from": 93, "to": 92, "label": "<i>40.0</i>\n\n0.0" },
    { "from": 35, "to": 75, "label": "<i>0.3</i>\n\n0.0" },
    { "from": 35, "to": 94, "label": "<i>25.5</i>\n\n0.0" },
    { "from": 5, "to": 63, "label": "<i>16.0</i>\n\n0.0" },
    { "from": 95, "to": 94, "label": "<i>31.5</i>\n\n0.0" },
    { "from": 16, "to": 26, "label": "<i>4.5</i>\n\n0.0" },
    { "from": 78, "to": 77, "label": "<i>28.0</i>\n\n0.0" },
    { "from": 96, "to": 97, "label": "<i>16.0</i>\n\n0.0" },
    { "from": 98, "to": 99, "label": "<i>40.0</i>\n\n0.0" },
    { "from": 24, "to": 77, "label": "<i>15.5</i>\n\n0.0" },
    { "from": 85, "to": 20, "label": "<i>3.0</i>\n\n0.0" },
    { "from": 80, "to": 94, "label": "<i>23.0</i>\n\n0.0" },
    { "from": 80, "to": 100, "label": "<i>8.0</i>\n\n0.0" },
    { "from": 101, "to": 73, "label": "<i>2.0</i>\n\n0.0" },
    { "from": 102, "to": 94, "label": "<i>31.5</i>\n\n0.0" },
    { "from": 102, "to": 49, "label": "<i>1.3</i>\n\n0.0" },
    { "from": 102, "to": 57, "label": "<i>2.5</i>\n\n0.0" },
    { "from": 3, "to": 100, "label": "<i>1.8</i>\n\n0.0" },
    { "from": 58, "to": 100, "label": "<i>2.8</i>\n\n0.0" },
    { "from": 24, "to": 26, "label": "<i>6.0</i>\n\n0.0" },
    { "from": 103, "to": 92, "label": "<i>41.0</i>\n\n0.0" },
    { "from": 104, "to": 63, "label": "<i>16.0</i>\n\n0.0" },
    { "from": 83, "to": 63, "label": "<i>24.0</i>\n\n0.0" },
    { "from": 39, "to": 63, "label": "<i>24.0</i>\n\n0.0" },
    { "from": 105, "to": 63, "label": "<i>40.0</i>\n\n0.0" },
    { "from": 90, "to": 92, "label": "<i>32.0</i>\n\n0.0" },
    { "from": 79, "to": 38, "label": "<i>0.5</i>\n\n0.0" },
    { "from": 79, "to": 23, "label": "<i>1.0</i>\n\n0.0" },
    { "from": 35, "to": 2, "label": "<i>3.5</i>\n\n0.0" },
    { "from": 16, "to": 106, "label": "<i>1.5</i>\n\n0.0" },
    { "from": 27, "to": 20, "label": "<i>0.8</i>\n\n0.0" },
    { "from": 86, "to": 77, "label": "<i>25.3</i>\n\n0.0" },
    { "from": 37, "to": 20, "label": "<i>1.0</i>\n\n0.0" },
    { "from": 52, "to": 2, "label": "<i>7.0</i>\n\n0.0" },
    { "from": 85, "to": 77, "label": "<i>3.0</i>\n\n0.0" },
    { "from": 53, "to": 26, "label": "<i>3.8</i>\n\n0.0" },
    { "from": 101, "to": 68, "label": "<i>3.5</i>\n\n0.0" },
    { "from": 95, "to": 65, "label": "<i>0.3</i>\n\n0.0" },
    { "from": 16, "to": 20, "label": "<i>3.5</i>\n\n0.0" },
    { "from": 30, "to": 26, "label": "<i>1.5</i>\n\n0.0" },
    { "from": 21, "to": 63, "label": "<i>8.0</i>\n\n0.0" },
    { "from": 85, "to": 26, "label": "<i>6.0</i>\n\n0.0" },
    { "from": 80, "to": 12, "label": "<i>2.0</i>\n\n0.0" },
    { "from": 107, "to": 108, "label": "<i>5.0</i>\n\n0.0" },
    { "from": 104, "to": 109, "label": "<i>2.5</i>\n\n0.0" },
    { "from": 104, "to": 110, "label": "<i>23.8</i>\n\n0.0" },
    { "from": 79, "to": 106, "label": "<i>0.5</i>\n\n0.0" },
    { "from": 102, "to": 6, "label": "<i>1.0</i>\n\n0.0" },
    { "from": 95, "to": 51, "label": "<i>0.3</i>\n\n0.0" },
    { "from": 95, "to": 68, "label": "<i>0.3</i>\n\n0.0" },
    { "from": 39, "to": 20, "label": "<i>0.5</i>\n\n0.0" },
    { "from": 71, "to": 63, "label": "<i>8.0</i>\n\n0.0" },
    { "from": 79, "to": 26, "label": "<i>0.5</i>\n\n0.0" },
    { "from": 82, "to": 23, "label": "<i>0.5</i>\n\n0.0" },
    { "from": 27, "to": 26, "label": "<i>0.3</i>\n\n0.0" },
    { "from": 30, "to": 46, "label": "<i>0.5</i>\n\n0.0" },
    { "from": 86, "to": 46, "label": "<i>0.8</i>\n\n0.0" },
    { "from": 95, "to": 63, "label": "<i>8.0</i>\n\n0.0" },
    { "from": 82, "to": 63, "label": "<i>0.8</i>\n\n0.0" }
  ]
}
        `; // This is the content read from data.json

        jsonData = JSON.parse(embeddedJsonDataContent);
    }

    // Directly use nodes and edges from the parsed JSON
    const initialNodes = jsonData.nodes;
    const initialEdges = jsonData.edges;

    // Extract all unique person and project names for selectors
    initialNodes.forEach(node => {
        // Extract the name from the label: "logged\n\nName\n\nallocated"
        const nameMatch = node.label.match(/\n\n(.*?)\n\n/);
        if (nameMatch && nameMatch[1]) {
            if (node.type === 'person') {
                allPeopleNames.push(nameMatch[1]);
            } else if (node.type === 'project') {
                allProjectNames.push(nameMatch[1]);
            }
        }
    });

    // Sort names alphabetically
    allPeopleNames.sort();
    allProjectNames.sort();

    // Initialize vis.DataSet instances
    nodesDataSet = new vis.DataSet(initialNodes.map(node => {
        if (node.type === 'person') {
            return { ...node, ...personNodeDefaults };
        } else if (node.type === 'project') {
            return { ...node, ...projectNodeDefaults };
        }
        return node;
    }));

    edgesDataSet = new vis.DataSet(initialEdges.map(edge => {
        return { ...edge, ...edgeopts };
    }));

    // Render network
    const container = document.getElementById('mynetwork');
    const graphData = {
      nodes: nodesDataSet,
      edges: edgesDataSet,
    };
    // Added vis.js network options for physics and layout.
    const options = {
        physics: {
            enabled: true,
            solver: 'barnesHut',
            stabilization: {
                iterations: 1000
            }
        },
        layout: {
            hierarchical: {
                enabled: true,
                direction: 'LR', // Left-to-right layout
                sortMethod: 'directed'
            }
        }
    }; 
    network = new vis.Network(container, graphData, options);
    // network.stabilize(100); // Stabilize on initial load - physics options handle this.

    // Initialize selectors and apply initial filter
    initializeSelectors();
    filterNetwork(); // Apply initial filter (all selected)

  } catch (error) {
    console.error('Failed to load or process data:', error);
    // Optionally display an error message in the UI
    const mynetworkContainer = document.getElementById('mynetwork');
    if (mynetworkContainer) {
        mynetworkContainer.textContent = 'Error loading data. Please check console for details.';
    }
  }
})();
