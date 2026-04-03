
// Base options for each node
const fontopts = {
  multi: true,
  bold: {
    color: '#ef004c' // Bold is red bold
  },
  ital: {
    color: '#00b000',
    mod: 'bold'  // Italic is green bold
  }
};
const nodeopts = {
  shape: "box",
  color: "#f0f0f0",
  font: fontopts
};
const edgeopts = {
  font: {
    ...fontopts,
    background: "#f9f9f9",
  }
};
// Using a bipartite graph, persons on the left and projects on the right.
const personNodeDefaults = { ...nodeopts, level: 0 }
const projectNodeDefaults = { ...nodeopts, level: 1 }

// Global variables for vis.js data and network instance
let nodesDataSet;
let edgesDataSet;
let network;
let allNodes = [];
let allEdges = [];
let allPeopleNames = [];
let allProjectNames = [];

// Optimized lookup maps
let nodeMap = new Map();
let nodeNameToIdMap = new Map();
let personToProjectsMap = new Map();
let projectToPeopleMap = new Map();

// Function to initialize the multi-select dropdowns
function initializeSelectors() {
  const personSelector = document.getElementById('person-selector');
  const projectSelector = document.getElementById('project-selector');

  // Populate person selector
  allPeopleNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.selected = false; // Start with none selected (which shows all)
    personSelector.appendChild(option);
  });

  // Populate project selector
  allProjectNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.selected = false; // Start with none selected
    projectSelector.appendChild(option);
  });

  // Add event listeners
  personSelector.addEventListener('change', filterNetwork);
  projectSelector.addEventListener('change', filterNetwork);
}

// Function to compose labels
function composeLabel(obj) {
  const logged = parseFloat(obj.logged_time) || 0;
  const alloc = parseFloat(obj.allocation) || 0;
  let taggedLogged = logged.toFixed(1);

  if (logged < alloc) {
    taggedLogged = `<b>${taggedLogged}</b>`;
  } else {
    taggedLogged = `<i>${taggedLogged}</i>`;
  }

  if (obj.name) {
    return `${taggedLogged}\n\n${obj.name}\n\n${alloc.toFixed(1)}`;
  } else {
    return `${taggedLogged}\n${alloc.toFixed(1)}`;
  }
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

  // Determine visible nodes
  const visibleNodeIds = new Set();

  if (allPeopleSelected && allProjectsSelected) {
    // Show everything if no specific filters are applied
    allNodes.forEach(node => visibleNodeIds.add(node.id));
  } else {
    // Add selected people and their connected projects
    selectedPeople.forEach(personName => {
      const personId = nodeNameToIdMap.get(personName);
      if (personId !== undefined) {
        visibleNodeIds.add(personId);
        // Add connected projects
        if (personToProjectsMap.has(personName)) {
          personToProjectsMap.get(personName).forEach(projectName => {
            const projectId = nodeNameToIdMap.get(projectName);
            if (projectId !== undefined) visibleNodeIds.add(projectId);
          });
        }
      }
    });

    // Add selected projects and their connected people
    selectedProjects.forEach(projectName => {
      const projectId = nodeNameToIdMap.get(projectName);
      if (projectId !== undefined) {
        visibleNodeIds.add(projectId);
        // Add connected people
        if (projectToPeopleMap.has(projectName)) {
          projectToPeopleMap.get(projectName).forEach(personName => {
            const personId = nodeNameToIdMap.get(personName);
            if (personId !== undefined) visibleNodeIds.add(personId);
          });
        }
      }
    });
  }

  // Update DataSets by adding/removing instead of hiding to prevent hidden nodes affecting layout
  const nodesToDisplay = allNodes.filter(node => visibleNodeIds.has(node.id));
  const edgesToDisplay = allEdges.filter(edge => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to));

  nodesDataSet.clear();
  nodesDataSet.add(nodesToDisplay);
  edgesDataSet.clear();
  edgesDataSet.add(edgesToDisplay);

  // Trigger relaxation and fit
  network.fit();
}


// Main execution block
(async () => {
  try {
    const response = await fetch('./data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const jsonData = await response.json();

    // Directly use nodes and edges from the parsed JSON
    allNodes = jsonData.nodes.map(node => {
      let defaults = node.type === 'person' ? personNodeDefaults : projectNodeDefaults;
      let fullNode = { ...defaults, ...node };
      fullNode.label = composeLabel(node);
      nodeMap.set(node.id, fullNode);
      if (node.name) {
        nodeNameToIdMap.set(node.name, node.id);
        if (node.type === 'person') allPeopleNames.push(node.name);
        else if (node.type === 'project') allProjectNames.push(node.name);
      }
      return fullNode;
    });

    allEdges = jsonData.edges.map(edge => ({
      ...edge,
      ...edgeopts,
      label: composeLabel(edge)
    }));

    // Build connection maps for filtering
    allEdges.forEach(edge => {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) return;

      const personNode = fromNode.type === 'person' ? fromNode : (toNode.type === 'person' ? toNode : null);
      const projectNode = fromNode.type === 'project' ? fromNode : (toNode.type === 'project' ? toNode : null);

      if (personNode && projectNode) {
        if (!personToProjectsMap.has(personNode.name)) personToProjectsMap.set(personNode.name, new Set());
        personToProjectsMap.get(personNode.name).add(projectNode.name);

        if (!projectToPeopleMap.has(projectNode.name)) projectToPeopleMap.set(projectNode.name, new Set());
        projectToPeopleMap.get(projectNode.name).add(personNode.name);
      }
    });

    // Sort names alphabetically
    allPeopleNames.sort();
    allProjectNames.sort();

    // Initialize vis.DataSet instances
    nodesDataSet = new vis.DataSet();
    edgesDataSet = new vis.DataSet();

    // Render network
    const container = document.getElementById('mynetwork');
    const graphData = {
      nodes: nodesDataSet,
      edges: edgesDataSet,
    };

    const options = {
      nodes: nodeopts,
      edges: edgeopts,
      physics: {
        enabled: false,
        solver: 'hierarchicalRepulsion',
        hierarchicalRepulsion: {
          centralGravity: 20,
          nodeDistance: 200,
          springLength: 200,
          springConstant: 0.001,
        },
        stabilization: {
          enabled: true,
          iterations: 100
        }
      },
      layout: {
        hierarchical: {
          enabled: true,
          levelSeparation: 300,
          direction: 'LR', // Left-to-right layout
          sortMethod: 'directed',
          blockShifting: true,
          edgeMinimization: true
        }
      }
    };
    network = new vis.Network(container, graphData, options);

    // Node click handler: synchronize with selection widgets
    network.on("click", (params) => {
      const personSelector = document.getElementById('person-selector');
      const projectSelector = document.getElementById('project-selector');

      if (params.nodes.length > 0) {
        const clickedNodeId = params.nodes[0];
        const clickedNode = nodeMap.get(clickedNodeId);

        if (clickedNode) {
          // Clear previous selections in widgets
          Array.from(personSelector.options).forEach(opt => opt.selected = false);
          Array.from(projectSelector.options).forEach(opt => opt.selected = false);

          // Select the clicked node in its corresponding widget
          if (clickedNode.type === 'person') {
            const opt = Array.from(personSelector.options).find(o => o.value === clickedNode.name);
            if (opt) opt.selected = true;
          } else if (clickedNode.type === 'project') {
            const opt = Array.from(projectSelector.options).find(o => o.value === clickedNode.name);
            if (opt) opt.selected = true;
          }
          filterNetwork();
        }
      }
    });

    // Initialize selectors and apply initial view
    initializeSelectors();
    filterNetwork();

  } catch (error) {
    console.error('Failed to load or process data:', error);
    const mynetworkContainer = document.getElementById('mynetwork');
    if (mynetworkContainer) {
      mynetworkContainer.textContent = 'Error loading data. Please check console for details.';
    }
  }
})();
