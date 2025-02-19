import React, { useState, useRef, useEffect, useCallback } from "react";
import useDebounce from "./useDebounce";
import "./App.css";
import ReactDOM from "react-dom/client";

function App() {
  // ------------------ State Variables ------------------
  const [title, setTitle] = useState("");
  const [autocompleteList, setAutocompleteList] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [coverRecs, setCoverRecs] = useState(null);
  const [error, setError] = useState("");
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [loadingCoverRecs, setLoadingCoverRecs] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showRemixModal, setShowRemixModal] = useState(false);
  const [ingredientsSelection, setIngredientsSelection] = useState({});
  const [isRemixing, setIsRemixing] = useState(false);
  const [originalMetadata, setOriginalMetadata] = useState(null);
  const [remixStack, setRemixStack] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  const debouncedTitle = useDebounce(title.trim(), 300);
  const suggestionsCache = useRef({});
  const skipNextAutocompleteRef = useRef(false);
  const showRightSide = loadingMetadata || loadingCoverRecs || metadata || coverRecs;

  // ------------------ Autocomplete ------------------
  const fetchAutocomplete = useCallback(async (q) => {
    try {
      const res = await fetch(`https://recipe-recommender-backend.onrender.com/autocomplete?title=${q}`);
      const data = await res.json();
      if (q === title.trim()) {
        suggestionsCache.current[q] = data || [];
        setAutocompleteList(data || []);
        setHighlightIndex(-1);
      }
    } catch (err) {
      console.error(err);
    }
  }, [title]);

  useEffect(() => {
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }
    if (!debouncedTitle || debouncedTitle.length < 3) {
      setAutocompleteList([]);
      setHighlightIndex(-1);
      return;
    }
    if (suggestionsCache.current[debouncedTitle]) {
      setAutocompleteList(suggestionsCache.current[debouncedTitle]);
      setHighlightIndex(-1);
    } else {
      fetchAutocomplete(debouncedTitle);
    }
  }, [debouncedTitle, fetchAutocomplete]);

  // ------------------ Input & Keyboard ------------------
  const handleInputChange = (e) => {
    setTitle(e.target.value);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!autocompleteList || autocompleteList.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, autocompleteList.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex < 0) {
          setHighlightIndex(0);
        } else {
          handleSuggestionClick(autocompleteList[highlightIndex]);
        }
        break;
      default:
        break;
    }
  };

  // ------------------ Suggestion Click (Search) ------------------
  const handleSuggestionClick = (suggestion) => {
    skipNextAutocompleteRef.current = true;
    setError("");
    setTitle("");
    setAutocompleteList([]);
    setHighlightIndex(-1);
    setMetadata(null);
    setCoverRecs(null);
    setLoadingMetadata(true);
    setLoadingCoverRecs(true);

    // Use Promise.all to fetch metadata and cover recs, then store them in history
    Promise.all([
      fetch(`https://recipe-recommender-backend.onrender.com/metadata?title=${suggestion}`).then((res) =>
        res.json()
      ),
      fetch(`https://recipe-recommender-backend.onrender.com/cover_recs?title=${suggestion}`).then((res) =>
        res.json()
      ),
    ])
      .then(([metadataData, coverRecsData]) => {
        if (metadataData.error) {
          setError(metadataData.error);
        } else {
          setMetadata(metadataData);
          setOriginalMetadata(metadataData);
          setCoverRecs(coverRecsData);
          setHistory((prev) => {
            const newEntry = {
              type: "search",
              recipe_name: metadataData.recipe_name,
              metadata: metadataData,
              coverRecs: coverRecsData,
            };
            return [newEntry, ...prev].slice(0, 10);
          });
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch search data");
      })
      .finally(() => {
        setLoadingMetadata(false);
        setLoadingCoverRecs(false);
      });
  };

  // ------------------ Helper Function ------------------
  const capitalizeFirstLetter = (text) => {
    if (!text || text.length === 0) return "";
    return text[0].toUpperCase() + text.slice(1);
  };

  // ------------------ REMIX MODAL FUNCTIONS ------------------
  const openRemixModal = () => {
    if (metadata && metadata.ingredients) {
      const initialSelection = {};
      metadata.ingredients.forEach((ing) => {
        initialSelection[ing] = true;
      });
      setIngredientsSelection(initialSelection);
    }
    setShowRemixModal(true);
  };

  // Prevent toggling if ingredient includes "salt", "sugar", or "oil"
  const toggleIngredient = (ingredient) => {
    if (
      ingredient.toLowerCase().includes("salt") ||
      ingredient.toLowerCase().includes("sugar") ||
      ingredient.toLowerCase().includes("oil")
    ) {
      return;
    }
    setIngredientsSelection((prev) => ({
      ...prev,
      [ingredient]: !prev[ingredient],
    }));
  };

  const handleRemix = () => {
    if (!metadata || !metadata.ingredients) return;
    setIsRemixing(true);
    const newIngredients = metadata.ingredients.filter(
      (ing) => ingredientsSelection[ing]
    );
    const payload = {
      original: metadata,
      newIngredients: newIngredients,
    };
    fetch("https://recipe-recommender-backend.onrender.com/remix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.text())
      .then((text) => {
        console.log("Raw response text:", text);
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          setError("Error parsing remix response: " + e.message);
          throw e;
        }
        return data;
      })
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMetadata(data);
          setRemixStack((prev) => [...prev, data]);
          setHistory((prev) => {
            const newEntry = {
              type: "remix",
              recipe_name: data.recipe_name,
              metadata: data,
              coverRecs: coverRecs, // Preserve current cover recs for remix items
            };
            return [newEntry, ...prev].slice(0, 10);
          });
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to remix recipe");
      })
      .finally(() => {
        setShowRemixModal(false);
        setIsRemixing(false);
      });
  };

  // Use cached metadata and coverRecs for history items
  const handleHistoryItemClick = (entry) => {
    setMetadata(entry.metadata);
    setCoverRecs(entry.coverRecs);
    setShowHistoryPanel(false);
  };

  const getCoverImage = () => {
    if (coverRecs && coverRecs.cover_image) {
      return coverRecs.cover_image;
    }
    return "/fallback.png";
  };

  // ------------------ Render ------------------
  return (
    <div className="app-container">
      {/* LEFT PANEL */}
      <div className="panel left-panel">
        <div className="header-container">
          {/* History Toggle Flap on the left (overlayed as a tab) */}
          <div
            className="history-toggle-flap"
            onClick={() => setShowHistoryPanel(true)}
          >
            <span className="toggle-arrow" role="img" aria-label="open history">
              →
            </span>
          </div>
          <h2 className="panel-title">AI Recipes</h2>
        </div>

        {/* Normal left-panel content (with margin-top to restore original position) */}
        <div className={`left-content ${showHistoryPanel ? "fade-out" : "fade-in"}`}>
          <form className="query-form" style={{ position: "relative" }} onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              placeholder="Enter a recipe name"
              value={title}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="query-input"
            />
            <button className="query-button" onClick={(e) => e.preventDefault()}>
              <img src="/magnifying-glass.png" alt="Search" className="search-icon" />
            </button>
            {autocompleteList.length > 0 && (
              <ul className="autocomplete-dropdown">
                {autocompleteList.map((item, i) => (
                  <li
                    key={i}
                    className={i === highlightIndex ? "highlighted" : ""}
                    onMouseEnter={() => setHighlightIndex(i)}
                    onClick={() => handleSuggestionClick(item)}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </form>

          {metadata || loadingMetadata ? (
            <>
              <div className="closest-match" style={{ marginTop: "20px" }}>
                {loadingMetadata && !metadata ? (
                  <div className="closest-match skeleton skeleton-recipe" style={{ height: "60px" }} />
                ) : metadata ? (
                  <p style={{ fontWeight: "bold", textTransform: "capitalize", fontSize: "20px", fontFamily: "'Funnel Display', sans-serif" }}>
                    {metadata.recipe_name}
                  </p>
                ) : null}
              </div>

              <div
                className="macro-card"
                style={{
                  marginTop: "20px",
                  background: "white",
                  borderRadius: "5px",
                  padding: "10px",
                  color: "#333",
                  height: "120px",
                  boxSizing: "border-box",
                }}
              >
                {loadingMetadata && !metadata ? (
                  <div className="skeleton" style={{ height: "80px", borderRadius: "5px" }} />
                ) : metadata && metadata.macros && !metadata.macros.error ? (
                  <>
                    <h4 style={{ margin: "0 0 10px 0", fontFamily: "'Funnel Display', sans-serif", fontWeight: "bold" }}>
                      {metadata.macros.calories} kcal
                    </h4>
                    <div
                      className="macro-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        rowGap: "4px",
                        columnGap: "12px",
                        fontFamily: "'Funnel Display', sans-serif",
                        fontSize: "14px"
                      }}
                    >
                      <p>Fat: {metadata.macros.fat}</p>
                      <p>Protein: {metadata.macros.protein}</p>
                      <p>Sugar: {metadata.macros.sugar}</p>
                      <p>Sat Fat: {metadata.macros.sat_fat}</p>
                      <p>Sodium: {metadata.macros.sodium}</p>
                      <p>Carbs: {metadata.macros.carbs}</p>
                    </div>

                  </>
                ) : (
                  <p style={{ margin: 0 }}>No macro info</p>
                )}
              </div>

              <div
                className="ingredients-card"
                style={{
                  marginTop: "20px",
                  background: "white",
                  borderRadius: "5px",
                  padding: "10px",
                  color: "#333",
                  height: "180px",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {loadingMetadata && !metadata ? (
                  <div className="skeleton" style={{ height: "80px", borderRadius: "5px" }} />
                ) : metadata && metadata.ingredients ? (
                  <>
                    <h4 style={{ margin: "0 0 5px 0", fontFamily: "'Funnel Display', sans-serif" }}>Ingredients</h4>
                    <div style={{ flex: 1, overflowY: "auto", fontFamily: "'Funnel Display', sans-serif" }}>
                      <ul style={{ margin: 0, paddingLeft: "20px" }}>
                        {metadata.ingredients.map((ing, idx) => (
                          <li key={idx} style={{ marginBottom: "3px" }}>{ing}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p>No ingredients found</p>
                )}
              </div>

              <button className="ai-remix-button" onClick={openRemixModal}>
                <img src="/sparkles-svgrepo-com.svg" alt="Remix Icon" className="remix-icon" />
                <span className="ai-remix-text">AI<br />Remix</span>
              </button>

              {/* {originalMetadata &&
                metadata &&
                metadata.recipe_name !== originalMetadata.recipe_name && (
                  <button className="original-recipe-button" onClick={() => setMetadata(originalMetadata)}>
                    Original Recipe
                  </button>
                )} */}
            </>
          ) : null}
          {error && <p className="error-message">{error}</p>}
        </div>

        {/* History Panel (covers the left panel) */}
        <div className={`history-panel ${showHistoryPanel ? "slide-in" : "slide-out"}`}>
          <div className="history-header">
            <span
              className="close-history"
              onClick={() => setShowHistoryPanel(false)}
              role="img"
              aria-label="close history"
            >
              ←
            </span>
            <h3>History</h3>
          </div>
          {history.map((entry, index) => (
            <div key={index} className="history-item" onClick={() => handleHistoryItemClick(entry)}>
              {entry.type === "remix" && (
                <span className="remix-emoji" role="img" aria-label="sparkles">
                  ✨
                </span>
              )}
              {entry.recipe_name}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="panel right-panel" style={{ paddingTop: "20px", overflowX: "hidden", boxSizing: "border-box" }}>
        {!showRightSide ? (
          <div className="landing-watermark" style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" }}>
            <p style={{ fontFamily: "'Funnel Display', sans-serif", fontSize: "20px" }}>Search to See Recipes!</p>
          </div>
        ) : (
          <>
            <div
              className="cover-card"
              style={{
                width: "100%",
                marginBottom: "20px",
                background: "#f8f8f8",
                padding: "20px",
                borderRadius: "10px",
                boxSizing: "border-box",
              }}
            >
              {loadingCoverRecs && !coverRecs ? (
                <div className="cover-image skeleton" style={{ width: "100%", height: "200px", marginBottom: "10px" }} />
              ) : coverRecs ? (
                <img
                  src={getCoverImage()}
                  alt="cover"
                  style={{ width: "100%", height: "200px", objectFit: "cover", borderRadius: "10px" }}
                />
              ) : (
                <img
                  src="/fallback.png"
                  alt="cover"
                  style={{ width: "100%", height: "200px", objectFit: "cover", borderRadius: "10px" }}
                />
              )}
              {metadata && (
                <div style={{ marginTop: "10px" }}>
                  <h2 style={{ margin: 0, textTransform: "capitalize", fontFamily: "'Funnel Display', sans-serif" }}>
                    {metadata.recipe_name}
                  </h2>
                  <p style={{ margin: 0, fontSize: "14px" }}>{metadata.minutes} mins</p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "20px", width: "100%", boxSizing: "border-box" }}>
              <div style={{ flex: "2", background: "#fff", borderRadius: "10px", padding: "10px", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontFamily: "'Funnel Display', sans-serif" }}>Steps</h3>
                <div style={{ flex: 1, overflowY: "auto", fontFamily: "'Funnel Display', sans-serif" }}>
                  {loadingMetadata && !metadata ? (
                    <div className="skeleton" style={{ height: "100px", borderRadius: "10px" }} />
                  ) : metadata && metadata.steps ? (
                    <ol>
                      {metadata.steps.map((step, i) => (
                        <li key={i} style={{ marginBottom: "5px" }}>
                          {capitalizeFirstLetter(step)}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>No steps loaded</p>
                  )}
                </div>
              </div>

              <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "10px", boxSizing: "border-box" }}>
                <h4 style={{ margin: "0 0 10px 0", fontFamily: "'Funnel Display', sans-serif" }}>Recommendations</h4>
                {loadingCoverRecs && !coverRecs
                  ? Array(4)
                      .fill(0)
                      .map((_, i) => (
                        <div key={i} className="recommendation-item skeleton" style={{ height: "50px" }} />
                      ))
                  : coverRecs && coverRecs.recommendations
                  ? coverRecs.recommendations.slice(0, 4).map((rec, i) => (
                      <div key={i} className="recommendation-item" style={{ fontSize: "14px", height: "50px" }} onClick={() => handleSuggestionClick(rec.recipe_name)}>
                        {rec.recipe_name}
                      </div>
                    ))
                  : (
                    <p style={{ textAlign: "center" }}>No recommendations</p>
                  )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* REMIX MODAL */}
      {showRemixModal && (
        <div className="remix-modal-overlay">
          <div className="remix-modal-content">
            <button className="modal-close-button" onClick={() => setShowRemixModal(false)}>
              &times;
            </button>
            <h2>Deselect Missing Ingredients</h2>
            <div className="chip-container">
              {metadata &&
                metadata.ingredients &&
                metadata.ingredients.map((ing) => {
                  const lowerIng = ing.toLowerCase();
                  const undeselectable =
                    lowerIng.includes("salt") || lowerIng.includes("sugar") || lowerIng.includes("oil");
                  return (
                    <span
                      key={ing}
                      className={`chip ${ingredientsSelection[ing] ? "selected" : "unselected"} ${
                        undeselectable ? "undeselectable" : ""
                      }`}
                      onClick={() => {
                        if (!undeselectable) toggleIngredient(ing);
                      }}
                    >
                      {ing}
                    </span>
                  );
                })}
            </div>
            <button className="remix-button" onClick={handleRemix} disabled={isRemixing}>
              {isRemixing ? <span className="spinner"></span> : "Remix"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

// Immediately render it:
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
