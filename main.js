require([
  "esri/Map",
  "esri/views/SceneView",
  "esri/layers/CSVLayer",
  "esri/layers/FeatureLayer",
  "esri/core/watchUtils"
], function(Map, SceneView, CSVLayer, FeatureLayer, watchUtils) {
  // define an empty map to store the country boundaries
  // and earthquake layers
  const map = new Map({
    ground: {
      opacity: 0
    }
  });

  // the view associated with the map has a transparent background
  // so that we can apply a CSS shadow filter for the glow
  const view = new SceneView({
    container: "view-container",
    qualityProfile: "high",
    map: map,
    alphaCompositingEnabled: true,
    environment: {
      background: {
        type: "color",
        color: [0, 0, 0, 0]
      },
      starsEnabled: false,
      atmosphereEnabled: false
    },
    ui: {
      components: []
    },
    highlightOptions: {
      color: "white"
    },
    padding: {
      bottom: 200
    },
    popup: {
      collapseEnabled: false,
      dockEnabled: false,
      dockOptions: {
        breakpoint: false
      }
    }
  });

  const exaggeratedElevation = {
    mode: "absolute-height",
    featureExpressionInfo: {
      expression: "-$feature.depth * 8"
    },
    unit: "kilometers"
  };

  const realElevation = {
    mode: "absolute-height",
    unit: "kilometers"
  };
  let exaggerated = true;

  // define the earthquakes layer
  const earthquakeLayer = new CSVLayer({
    url: "./earthquakes_2019.csv",
    elevationInfo: exaggeratedElevation,
    screenSizePerspectiveEnabled: false,
    renderer: {
      type: "simple",
      symbol: {
        type: "point-3d",
        symbolLayers: [
          {
            type: "icon",
            resource: { primitive: "circle" }
          }
        ]
      },
      visualVariables: [
        {
          type: "size",
          field: "mag",
          legendOptions: {
            title: "Magnitude"
          },
          stops: [
            { value: 6, size: "3px", label: "4.5 - 6" },
            { value: 7, size: "25px", label: ">7" }
          ]
        },
        {
          type: "color",
          field: "mag",
          legendOptions: {
            title: "Magnitude"
          },
          stops: [
            { value: 6, color: [254, 240, 217], label: "4.5 - 6" },
            { value: 7, color: [179, 0, 0], label: ">7" }
          ]
        }
      ]
    },
    popupTemplate: {
      content: "Magnitude {mag} {type} hit {place} on {time} at a depth of {depth} km.",
      title: "Earthquake info",
      fieldInfos: [
        {
          fieldName: "time",
          format: {
            dateFormat: "short-date-long-time-24"
          }
        },
        {
          fieldName: "mag",
          format: {
            places: 1,
            digitSeparator: true
          }
        },
        {
          fieldName: "depth",
          format: {
            places: 1,
            digitSeparator: true
          }
        }
      ]
    }
  });

  map.add(earthquakeLayer);

  let earthquakeLayerView = null;
  let highlightHandler = null;

  view.whenLayerView(earthquakeLayer).then(function(lyrView) {
    earthquakeLayerView = lyrView;
  });

  const countryBorders = new FeatureLayer({
    url:
      "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0",
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d",
        symbolLayers: [
          {
            type: "fill",
            outline: {
              color: [255, 255, 255],
              size: 0.75
            }
          }
        ]
      }
    }
  });

  map.add(countryBorders);

  function formatDate(date) {
    const fDate = new Date(date);
    const year = fDate.getFullYear();
    const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(fDate);
    const day = fDate.getDate();
    const hours = fDate.getHours();
    const minutes = fDate.getMinutes();
    const prefix = minutes < 10 ? "0" : "";
    return `${day} ${month} ${year}, at ${hours}:${prefix}${minutes}`;
  }

  earthquakeLayer
    .queryFeatures({
      where: "mag > 7"
    })
    .then(function(result) {
      const features = result.features;
      const list = document.getElementById("earthquake-list");
      features.forEach(function(earthquake) {
        const attr = earthquake.attributes;
        const content = document.createElement("div");
        content.innerHTML = `
          <div>
            <h3>${attr.place}</h3>
            <span class="date-time"><i>${formatDate(attr.time)}</i></span>
            </br>
            Magnitude ${attr.mag} | Depth ${attr.depth} km
          </div>
        `;
        const goToButton = document.createElement("button");
        goToButton.innerText = "Zoom to earthquake";
        goToButton.addEventListener("click", function() {
          view.goTo({ target: earthquake, zoom: 5 }, { speedFactor: 0.5 });
          if (earthquakeLayerView) {
            if (highlightHandler) {
              highlightHandler.remove();
            }
            highlightHandler = earthquakeLayerView.highlight(earthquake);
          }
        });
        content.appendChild(goToButton);
        list.appendChild(content);
      });
    })
    .catch(console.error);

  document.getElementById("toggle-exaggeration").addEventListener("click", function() {
    if (exaggerated) {
      earthquakeLayer.elevationInfo = realElevation;
      exaggerated = false;
    } else {
      earthquakeLayer.elevationInfo = exaggeratedElevation;
      exaggerated = true;
    }
  });

  function rotate() {
    if (!view.interacting) {
      const camera = view.camera.clone();
      camera.position.longitude -= 0.1;
      view.camera = camera;
      requestAnimationFrame(rotate);
    }
  }

  view.when(function() {
    view.constraints.clipDistance.far = 50000000;
    watchUtils.whenFalseOnce(view, "updating", function() {
      rotate();
    });
  });

  let legendVisible = true;
  const legendController = document.getElementById("legend-control");
  const legendContainer = document.getElementById("legend");
  legendController.addEventListener("click", function() {
    legendContainer.style.display = legendVisible ? "none" : "block";
    legendController.innerHTML = legendVisible ? "Show explanation" : "Hide explanation";
    legendVisible = !legendVisible;
  });
});
