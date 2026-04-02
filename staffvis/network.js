
// Base options for each node
const nodeopts = {
  shape: "box",
  color: "#f0f0f0",
  font: {
    multi: true,
    bold: {
      color: '#ef004c' // Bold is red bold
    },
    ital: {
      color: '#00b000',
      mod: 'bold'  // Italic is green bold
    }
  }
}
const edgeopts = {
  font: {
    multi: true,
    bold: {
      color: '#ef004c' // Bold is red bold
    },
    ital: {
      color: '#00b000',
      mod: 'bold'  // Italic is green bold
    }
  }
}
// Using a bipartite graph, persons on the left and projects on the right.
const personNodeDefaults = { ...nodeopts, level: 0 }
const projectNodeDefaults = { ...nodeopts, level: 1 }

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
  const visibleNodeIds = new Set();

  // Map node names to their IDs for quick lookup
  const nodeNameToIdMap = new Map();
  nodesDataSet.forEach(node => {
    if (node.name) {
      nodeNameToIdMap.set(node.name, node.id);
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

    const personName = personNode.name;
    const projectName = projectNode.name;

    if (personName && projectName) {
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
  network.setOptions({ physics: { enabled: true } });
  network.stabilize(100); // physics is on
  network.fit();
  network.stabilize(100); // physics is off
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
    const initialNodes = jsonData.nodes;
    const initialEdges = jsonData.edges;

    // Extract all unique person and project names for selectors
    initialNodes.forEach(node => {
      if (node.name) {
        if (node.type === 'person') {
          allPeopleNames.push(node.name);
        } else if (node.type === 'project') {
          allProjectNames.push(node.name);
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

    const options = {
      nodes: nodeopts,
      edges: edgeopts,
      physics: {
        enabled: true,
        //solver: 'barnesHut',
      },
      layout: {
        hierarchical: {
          enabled: true,
          nodeSpacing: 150,
          direction: 'LR', // Left-to-right layout
          sortMethod: 'directed',
          blockShifting: true,
          edgeMinimization: true
        }
      }
    };
    network = new vis.Network(container, graphData, options);
    network.on("stabilized", () => {
      network.setOptions({ physics: { enabled: false } });
    });

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
