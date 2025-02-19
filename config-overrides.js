// config-overrides.js

module.exports = (config, env) => {
    // We'll detect a custom environment variable to decide if this is "mobile" or "desktop"
    const buildType = process.env.REACT_APP_BUILD_TYPE; // e.g., 'mobile' or 'desktop'
  
    if (buildType === "mobile") {
      // 1) Change the entry point
      config.entry = "./src/MobileApp.js";
  
      // 2) Customize the output filenames (optional)
      // By default, CRA uses hashed names like main.[hash].chunk.js
      // You can override them if you want more explicit naming:
      config.output.filename = "static/js/[name].mobile.js";
      config.output.chunkFilename = "static/js/[name].mobile.chunk.js";
    } else {
      // Assume "desktop"
      config.entry = "./src/App.js";
  
      config.output.filename = "static/js/[name].desktop.js";
      config.output.chunkFilename = "static/js/[name].desktop.chunk.js";
    }
  
    return config;
  };
  