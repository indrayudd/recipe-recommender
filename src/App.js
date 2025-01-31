import React, { useState, useRef, useEffect, useCallback } from "react";
import useDebounce from "./useDebounce";
import "./App.css";

function App() {
  const [title, setTitle] = useState("");
  const [autocompleteList, setAutocompleteList] = useState([]);

  // We'll store metadata + cover + recs
  // metadata => { recipe_name, minutes, macros, steps, ingredients }
  // coverRecs => { cover_image, recommendations }
  const [metadata, setMetadata] = useState(null);
  const [coverRecs, setCoverRecs] = useState(null);

  const [error, setError] = useState("");
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [loadingCoverRecs, setLoadingCoverRecs] = useState(false);

  // For arrow-key highlight in the dropdown
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // Debounce user input for performance
  const debouncedTitle = useDebounce(title.trim(), 300);
  const suggestionsCache = useRef({});
  const skipNextAutocompleteRef = useRef(false);

  // We only show the right panel if we have data or are loading
  const showRightSide = loadingMetadata || loadingCoverRecs || metadata || coverRecs;

  // ----------------------------------------------------------------
  // AUTOCOMPLETE
  // ----------------------------------------------------------------
  const fetchAutocomplete = useCallback(async (q) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/autocomplete?title=${q}`);
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

  // ----------------------------------------------------------------
  // INPUT & KEYBOARD
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // SUGGESTION CLICK
  // ----------------------------------------------------------------
  const handleSuggestionClick = (suggestion) => {
    skipNextAutocompleteRef.current = true;
    setError("");
    setTitle("");
    setAutocompleteList([]);
    setHighlightIndex(-1);

    // Clear old data
    setMetadata(null);
    setCoverRecs(null);

    setLoadingMetadata(true);
    setLoadingCoverRecs(true);

    // 1) METADATA
    fetch(`http://127.0.0.1:5000/metadata?title=${suggestion}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMetadata(data);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch metadata");
      })
      .finally(() => setLoadingMetadata(false));

    // 2) COVER + RECS
    fetch(`http://127.0.0.1:5000/cover_recs?title=${suggestion}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setCoverRecs(data);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch cover/recs");
      })
      .finally(() => setLoadingCoverRecs(false));
  };

  // ----------------------------------------------------------------
  // HELPER: Capitalize first letter of a step
  // ----------------------------------------------------------------
  const capitalizeFirstLetter = (text) => {
    if (!text || text.length === 0) return "";
    return text[0].toUpperCase() + text.slice(1);
  };

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------

  // Fallback local image if DALL·E fails or returns nothing
  const getCoverImage = () => {
    // If we do have coverRecs && coverRecs.cover_image is non-empty => use it
    // else => fallback to a local 'fallback.png'
    if (coverRecs && coverRecs.cover_image) {
      return coverRecs.cover_image;
    }
    return "/fallback.png"; // your local fallback image in public/
  };

  return (
    <div className="app-container">
      {/* LEFT PANEL */}
      <div className="panel left-panel">
        <h2 className="panel-title" style={{ fontFamily: "'Funnel Display', sans-serif", textAlign: "center" }}>
          AI Recipes
        </h2>
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

        {(metadata || loadingMetadata) && (
          <>
            {/* Closest match card => recipe name */}
            <div className="closest-match" style={{ marginTop: "20px" }}>
              {loadingMetadata && !metadata ? (
                <div className="closest-match skeleton skeleton-recipe" style={{ height: "60px" }} />
              ) : metadata ? (
                <p style={{ fontWeight: "bold", textTransform: "capitalize", fontSize: "20px", fontFamily: "'Funnel Display', sans-serif" }}>
                  {metadata.recipe_name}
                </p>
              ) : null}
            </div>

            {/* Macros Card */}
            <div
              className="macro-card"
              style={{
                marginTop: "20px",
                background: "white",
                borderRadius: "5px",
                padding: "10px",
                color: "#333",
                height: "180px",
                boxSizing: "border-box"
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

            {/* Ingredients Card */}
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
                flexDirection: "column"
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
                        <li key={idx} style={{ marginBottom: "3px" }}>
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p>No ingredients found</p>
              )}
            </div>
          </>
        )}

        {error && <p className="error-message">{error}</p>}
      </div>

      {/* RIGHT PANEL */}
      <div className="panel right-panel" style={{ paddingTop: "20px", overflowX: "hidden", boxSizing: "border-box" }}>
        {!showRightSide ? (
          <div className="landing-watermark" style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" }}>
            <p style={{ fontFamily: "'Funnel Display', sans-serif", fontSize: "20px" }}>Search to See Recipes!</p>
          </div>
        ) : (
          <>
            {/* Cover Card => fallback to local if DALL·E fails */}
            <div
              className="cover-card"
              style={{
                width: "100%",
                marginBottom: "20px",
                background: "#f8f8f8",
                padding: "20px",
                borderRadius: "10px",
                boxSizing: "border-box"
              }}
            >
              {loadingCoverRecs && !coverRecs ? (
                <div className="cover-image skeleton" style={{ width: "100%", height: "200px", marginBottom: "10px" }} />
              ) : coverRecs ? (
                <img
                  src={coverRecs.cover_image || "/fallback.png"} 
                  /* If cover_image is empty or undefined, fallback.png */
                  alt="cover"
                  style={{
                    width: "100%",
                    height: "200px",
                    objectFit: "cover",
                    borderRadius: "10px"
                  }}
                />
              ) : (
                // If coverRecs is null or there's an error, also show fallback
                <img
                  src="/fallback.png"
                  alt="cover"
                  style={{
                    width: "100%",
                    height: "200px",
                    objectFit: "cover",
                    borderRadius: "10px"
                  }}
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
              {/* Steps */}
              <div style={{ flex: "2", background: "#fff", borderRadius: "10px", padding: "10px", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontFamily: "'Funnel Display', sans-serif" }}>Steps</h3>
                <div style={{ flex: 1, overflowY: "auto", fontFamily: "'Funnel Display', sans-serif" }}>
                  {loadingMetadata && !metadata ? (
                    <div className="skeleton" style={{ height: "100px", borderRadius: "10px" }} />
                  ) : metadata && metadata.steps ? (
                    <ol>
                      {metadata.steps.map((step, i) => {
                        const capitalizedStep = capitalizeFirstLetter(step);
                        return (
                          <li key={i} style={{ marginBottom: "5px" }}>{capitalizedStep}</li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p>No steps loaded</p>
                  )}
                </div>
              </div>

              {/* Recommendations */}
              <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "10px", boxSizing: "border-box" }}>
                <h4 style={{ margin: "0 0 10px 0", fontFamily: "'Funnel Display', sans-serif" }}>Recommendations</h4>
                {loadingCoverRecs && !coverRecs
                  ? Array(4).fill(0).map((_, i) => (
                      <div key={i} className="recommendation-item skeleton" style={{ height: "50px" }} />
                    ))
                  : coverRecs && coverRecs.recommendations
                  ? coverRecs.recommendations.slice(0, 4).map((rec, i) => (
                      <div
                        key={i}
                        className="recommendation-item"
                        style={{ fontSize: "14px", height: "50px" }}
                        onClick={() => handleSuggestionClick(rec.recipe_name)}
                      >
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
    </div>
  );
}

export default App;
