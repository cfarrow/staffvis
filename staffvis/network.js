
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
const person =  { ...nodeopts, level: 0 }
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

var options = {
  width: '100%',
  height: '800px',
  layout: {
    hierarchical: {
      enabled: true,
      direction: "LR"
    }
  },
  nodes: {
    font : fontopts,
  },
  edges: {
    font : {background: "#ffffff", ...fontopts},
  }
};

// Load data from data.json
fetch('data.json')
  .then(response => response.json())
  .then(data => {
    // create an array with nodes
    var nodes = new vis.DataSet(data.nodes.map(node => {
      if (node.type === 'person') {
        return { ...node, ...person };
      } else if (node.type === 'project') {
        return { ...node, ...project };
      }
      return node;
    }));

    // create an array with edges
    var edges = new vis.DataSet(data.edges.map(edge => {
	return {...edge, ...edgeopts}
    }));

    // Render
    var container = document.getElementById("mynetwork");
    var graphData = {
      nodes: nodes,
      edges: edges,
    };
    var network = new vis.Network(container, graphData, options);
  })
  .catch(error => console.error('Error loading data:', error));



