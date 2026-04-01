
import { formatCombinedDataForNetwork, getCombinedAllocationsAndLoggedTime } from "./api.js";

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
const person = { ...nodeopts, level: 0 }
const project = { ...nodeopts, level: 1 }

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

const options = {
  width: '100%',
  height: '800px',
  layout: {
    hierarchical: {
      enabled: true,
      levelSeparation: 300,
      nodeSpacing: 100,
      direction: "LR"
    }
  },
  nodes: {
    font: fontopts,
  },
  edges: {
    font: { background: "#ffffff", ...fontopts },
  },
  physics: {
    enabled: false,
    barnesHut: {
      springLength: 1000,
      centralGravity: 0.01,
      gravitationalConstant: -10,
      sprintConstant: 0.01,
      avoidOverlap: 1
    }
  }
};

fetch('data.json')
  .then(response => response.json())
  .then(data => {
    // create an array with nodes
    let nodes = new vis.DataSet(data.nodes.map(node => {
      if (node.type === 'person') {
        return { ...node, ...person };
      } else if (node.type === 'project') {
        return { ...node, ...project };
      }
      return node;
    }));

    // create an array with edges
    let edges = new vis.DataSet(data.edges.map(edge => {
      return { ...edge, ...edgeopts }
    }));

    // Render
    let container = document.getElementById("mynetwork");
    let graphData = {
      nodes: nodes,
      edges: edges,
    };
    let network = new vis.Network(container, graphData, options);
    network.stabilize(10);
  });
