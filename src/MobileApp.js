import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";
import "./MobileApp.css";
import useDebounce from "./useDebounce";

/** Capitalize helpers */
function capitalizeSentence(str) {
  if (!str || !str.length) return str;
  str = str.trim();
  return str[0].toUpperCase() + str.slice(1);
}
function capitalizeWords(str) {
  if (!str) return str;
  return str
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export default function MobileApp() {
  // ------------------ AUTOCOMPLETE ------------------
  const [title, setTitle] = useState("");
  const [autocompleteList, setAutocompleteList] = useState([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const skipNextAutocompleteRef = useRef(false);
  const debouncedTitle = useDebounce(title.trim(), 300);
  const suggestionsCache = useRef({});

  // ------------------ MAIN STATES ------------------
  const [metadata, setMetadata] = useState(null);
  const [coverRecs, setCoverRecs] = useState(null);
  const [error, setError] = useState("");

  // Loading states
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [loadingCoverRecs, setLoadingCoverRecs] = useState(false);

  // TABS
  const [currentTab, setCurrentTab] = useState("recipe");

  // AI Remix
  const [isActive, setIsActive] = useState(false); // toggles color & sparkles
  const [isLoading, setIsLoading] = useState(false); // for spinner while remixing

  // We'll store which ingredients are selected for remix
  const [ingredientsSelection, setIngredientsSelection] = useState({});

  // HISTORY
  // We'll store array of objects: { recipeName, metadata, coverRecs, type }
  // "type" can be "search" or "remix"
  const [historyStack, setHistoryStack] = useState([]);

  // Nav icons
  const icons = {
    history: {
      active: "/assets/icons/history-active.svg",
      inactive: "/assets/icons/history-inactive.svg",
    },
    recipe: {
      active: "/assets/icons/recipe-active.svg",
      inactive: "/assets/icons/recipe-inactive.svg",
    },
    info: {
      active: "/assets/icons/info-active.svg",
      inactive: "/assets/icons/info-inactive.svg",
    },
  };

  // =========================
  // AUTOCOMPLETE LOGIC
  // =========================
  const fetchAutocomplete = useCallback(async (q) => {
    try {
      const res = await fetch(
        `https://recipe-recommender-backend.onrender.com/autocomplete?title=${q}`
      );
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
        if (highlightIndex >= 0) {
          handleSuggestionClick(autocompleteList[highlightIndex]);
        }
        break;
      default:
        break;
    }
  };

  // =========================
  // SELECT RECIPE (like desktop)
  // =========================
  const handleSuggestionClick = (recipeName) => {
    skipNextAutocompleteRef.current = true;
    setTitle("");
    setAutocompleteList([]);
    setHighlightIndex(-1);
    setError("");
    setCurrentTab("recipe");

    // Check if in history
    const found = historyStack.find((x) => x.recipeName === recipeName);
    if (found) {
      // Use cached
      setMetadata(found.metadata);
      setCoverRecs(found.coverRecs);
      // Move to front
      setHistoryStack((prev) => {
        const filtered = prev.filter((x) => x.recipeName !== recipeName);
        return [{ ...found }, ...filtered].slice(0, 10);
      });
    } else {
      // fetch
      setLoadingMetadata(true);
      setLoadingCoverRecs(true);
      setMetadata(null);
      setCoverRecs(null);

      Promise.all([
        fetch(`https://recipe-recommender-backend.onrender.com/metadata?title=${encodeURIComponent(recipeName)}`)
          .then(r => r.json()),
        fetch(`https://recipe-recommender-backend.onrender.com/cover_recs?title=${encodeURIComponent(recipeName)}`)
          .then(r => r.json()),
      ])
        .then(([metaData, coverData]) => {
          if (metaData.error) {
            setError(metaData.error);
            return;
          }
          setMetadata(metaData);
          setCoverRecs(coverData);
          // store in history
          setHistoryStack((prev) => {
            const filtered = prev.filter((x) => x.recipeName !== recipeName);
            const newEntry = {
              recipeName,
              metadata: metaData,
              coverRecs: coverData,
              type: "search",
            };
            return [newEntry, ...filtered].slice(0, 10);
          });
        })
        .catch((err) => {
          console.error(err);
          setError("Failed to fetch recipe data");
        })
        .finally(() => {
          setLoadingMetadata(false);
          setLoadingCoverRecs(false);
        });
    }
  };

  // =========================
  // HISTORY + NAV
  // =========================
  useEffect(() => {
    // If we leave 'remix' tab => reset the AI button
    if (currentTab !== "remix") {
      setIsActive(false);
      setIsLoading(false);
    }
  }, [currentTab]);

  const handleNavClick = (tab) => {
    setCurrentTab(tab);
  };

  // =========================
  // AI Remix: toggling
  // =========================
  const handleAiButtonClick = async () => {
    if (!isActive) {
      // We are not in remix => switch to remix
      // and init the selected ingredients
      if (metadata && metadata.ingredients) {
        initRemixIngredients(metadata.ingredients);
      }
      setIsActive(true);
      setCurrentTab("remix");
    } else {
      // We are already in remix => user wants to "Remix" now
      if (!metadata || !metadata.ingredients) {
        // No recipe => do nothing
        return;
      }
      // show spinner
      setIsLoading(true);

      // Gather new ingredients
      const newIngredients = metadata.ingredients.filter((ing) => ingredientsSelection[ing]);
      const payload = {
        original: metadata,
        newIngredients,
      };
      try {
        const res = await fetch("https://recipe-recommender-backend.onrender.com/remix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        console.log("Remix raw text:", text);
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          setError("Error parsing remix response: " + e.message);
          throw e;
        }
        if (data.error) {
          setError(data.error);
        } else {
          // We have the new AI recipe
          setMetadata(data);
          // keep old coverRecs or fetch new? We'll keep old
          // store in history
          setHistoryStack((prev) => {
            const filtered = prev.filter((x) => x.recipeName !== data.recipe_name);
            // We'll display "✨ " in front
            const newEntry = {
              recipeName: "✨ " + data.recipe_name,
              metadata: data,
              coverRecs: coverRecs,
              type: "remix",
            };
            return [newEntry, ...filtered].slice(0, 10);
          });
          // Switch to recipe tab
          setCurrentTab("recipe");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to remix recipe");
      } finally {
        setIsLoading(false);
        setIsActive(false);
      }
    }
  };

  // Initialize all ingredients as selected
  const initRemixIngredients = (ings) => {
    const initSel = {};
    ings.forEach((ing) => {
      initSel[ing] = true;
    });
    setIngredientsSelection(initSel);
  };

  // Toggle chip
  const toggleIngredient = (ingredient) => {
    // block salt/sugar/oil/water
    const lower = ingredient.toLowerCase();
    if (
      lower.includes("salt") ||
      lower.includes("sugar") ||
      lower.includes("oil") ||
      lower.includes("water")
    ) {
      return;
    }
    setIngredientsSelection((prev) => ({
      ...prev,
      [ingredient]: !prev[ingredient],
    }));
  };

  // =========================
  // RECOMMENDATIONS
  // =========================
  const renderRecommendations = () => {
    if (!coverRecs || !coverRecs.recommendations) return null;
    return (
      <>
        <h3 className="recommendation-heading">Recommendations</h3>
        {loadingCoverRecs ? (
          <div className="recommendation-grid">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="recommendation-card skeleton-recommendation" />
            ))}
          </div>
        ) : (
          <div className="recommendation-grid">
            {coverRecs.recommendations.slice(0, 4).map((rec, i) => (
              <div
                key={i}
                className="recommendation-card"
                onClick={() => handleSuggestionClick(rec.recipe_name)}
              >
                <p className="recommendation-name">{rec.recipe_name}</p>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // =========================
  // SKELETON LOADERS
  // =========================
  const renderRecipeSkeleton = () => {
    return (
      <div className="recipe-page">
        <div className="recipe-cover-card skeleton-card" />
        <div className="skeleton-steps" />
        <h3 className="recommendation-heading">Recommendations</h3>
        <div className="recommendation-grid">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="recommendation-card skeleton-recommendation" />
          ))}
        </div>
      </div>
    );
  };
  const renderInfoSkeleton = () => {
    return (
      <div className="info-page">
        <div className="info-cover-card skeleton-card" />
        <div className="info-stats-row">
          <div className="macros-card skeleton-card" />
          <div className="prep-time-card skeleton-card" />
        </div>
        <div className="ingredients-card skeleton-card" />
      </div>
    );
  };

  // =========================
  // RENDER REMIX PAGE
  // =========================
  const renderRemixPage = () => {
    if (!metadata) {
      return (
        <div style={{ padding: 20 }}>
          <h2>No recipe loaded to remix!</h2>
        </div>
      );
    }
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ marginBottom: 8 }}>AI Remix Page</h2>
        {/* Show recipe name + cover */}
        <div className="info-cover-card" style={{ marginBottom: 16 }}>
          <h2 className="info-title">{metadata.recipe_name}</h2>
          <img
            className="info-cover"
            src={coverRecs?.cover_image || "/fallback.png"}
            alt="Recipe Cover"
          />
        </div>

        <p>Deselect Missing Ingredients:</p>
        <div className="chip-container">
          {metadata.ingredients?.map((ing) => {
            const lowerIng = ing.toLowerCase();
            const locked =
              lowerIng.includes("salt") ||
              lowerIng.includes("sugar") ||
              lowerIng.includes("oil") ||
              lowerIng.includes("water");
            const selected = ingredientsSelection[ing];
            return (
              <span
                key={ing}
                className={`chip ${selected ? "selected" : "unselected"} ${
                  locked ? "undeselectable" : ""
                }`}
                onClick={() => {
                  if (!locked) toggleIngredient(ing);
                }}
              >
                {capitalizeWords(ing)}
              </span>
            );
          })}
        </div>

        <p>
          Tap the <strong>AI Remix Button</strong> again below to finalize your remix.
        </p>
      </div>
    );
  };

  // =========================
  // RENDER MAIN CONTENT
  // =========================
  const renderContent = () => {
    switch (currentTab) {
      case "history":
        return (
          <div style={{ padding: 20 }}>
            <h2>History</h2>
            {historyStack.length === 0 && <p>No history yet.</p>}

            {/** 
             *  This is where we modify the displayed text 
             *  to ensure first-letter capitalized. 
             */}
            {historyStack.map((item, idx) => {
              let displayName = item.recipeName.trim();

              // If this is a remix, we might have stored "✨ " already.
              // So let's handle it carefully:
              if (displayName.startsWith("✨ ")) {
                // remove the "✨ " portion, then capitalize, then re-prepend "✨ "
                const rest = displayName.slice(2).trim();
                displayName = "✨ " + capitalizeSentence(rest);
              } else {
                // normal case => just capitalize
                displayName = capitalizeSentence(displayName);
              }

              return (
                <div
                  key={idx}
                  className="history-item"
                  onClick={() => {
                    setCurrentTab("recipe");
                    // user picks from history => move item to front
                    const filtered = historyStack.filter(x => x.recipeName !== item.recipeName);
                    setHistoryStack([{ ...item }, ...filtered].slice(0, 10));
                    setMetadata(item.metadata);
                    setCoverRecs(item.coverRecs);
                  }}
                >
                  <strong>{displayName}</strong>
                </div>
              );
            })}
          </div>
        );

      case "recipe":
        if (loadingMetadata) {
          return renderRecipeSkeleton();
        }
        return (
          <div className="recipe-page">
            {metadata ? (
              <>
                <div className="recipe-cover-card">
                  <h2 className="recipe-title">{metadata.recipe_name}</h2>
                  <img
                    className="recipe-cover"
                    src={
                      coverRecs?.cover_image
                        ? coverRecs.cover_image
                        : "/fallback.png"
                    }
                    alt="Recipe Cover"
                  />
                </div>

                {metadata.steps?.length ? (
                  <ol className="recipe-steps">
                    {metadata.steps.map((step, i) => {
                      const capStep = capitalizeSentence(step);
                      return <li key={i}>{capStep}</li>;
                    })}
                  </ol>
                ) : (
                  <p>No steps found</p>
                )}

                {renderRecommendations()}
              </>
            ) : (
              <p style={{ padding: 16 }}>No recipe selected yet</p>
            )}
          </div>
        );

      case "info":
        if (loadingMetadata) {
          return renderInfoSkeleton();
        }
        return (
          <div className="info-page">
            {metadata ? (
              <>
                <div className="info-cover-card">
                  <h2 className="info-title">{metadata.recipe_name}</h2>
                  <img
                    className="info-cover"
                    src={
                      coverRecs?.cover_image
                        ? coverRecs.cover_image
                        : "/fallback.png"
                    }
                    alt="Recipe Cover"
                  />
                </div>

                <div className="info-stats-row">
                  <div className="macros-card">
                    <h4>Macros</h4>
                    {metadata.macros ? (
                      <div className="macros-list">
                        <p><strong>Calories:</strong> {metadata.macros.calories}</p>
                        <p><strong>Carbs:</strong> {metadata.macros.carbs}</p>
                        <p><strong>Fat:</strong> {metadata.macros.fat}</p>
                        <p><strong>Protein:</strong> {metadata.macros.protein}</p>
                        <p><strong>Sat Fat:</strong> {metadata.macros.sat_fat}</p>
                        <p><strong>Sugar:</strong> {metadata.macros.sugar}</p>
                      </div>
                    ) : (
                      <p>No macro info</p>
                    )}
                  </div>

                  <div className="prep-time-card">
                    <h4>Prep Time</h4>
                    <p style={{ fontSize: "18px", margin: "8px 0" }}>
                      {metadata.minutes} mins
                    </p>
                  </div>
                </div>

                <div className="ingredients-card">
                  <h4>Ingredients</h4>
                  {metadata.ingredients?.length ? (
                    <ul>
                      {metadata.ingredients.map((ing, idx) => {
                        const capitalizedIng = capitalizeWords(ing);
                        return <li key={idx}>{capitalizedIng}</li>;
                      })}
                    </ul>
                  ) : (
                    <p>No ingredients found</p>
                  )}
                </div>
              </>
            ) : (
              <p style={{ padding: 16 }}>No recipe selected yet</p>
            )}
          </div>
        );

      case "remix":
        // show the "deselect missing ingredients" UI
        return renderRemixPage();

      default:
        return <div style={{ padding: 20 }}><h2>Default Page</h2></div>;
    }
  };

  // The big AI button color & icon
  const remixBgColor = isActive ? "#4A9390" : "#EBF7F7";
  let remixIcon = isActive
    ? "/assets/icons/sparkles-white.svg"
    : "/assets/icons/sparkles-teal.svg";
  if (isLoading) {
    remixIcon = null;
  }

  return (
    <div className="mobile-container">
      {/* Header + search */}
      <header className="mobile-top-header">
        <h2 className="mobile-title">AI Recipes</h2>
        <div className="mobile-search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search recipes..."
            value={title}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <button className="search-button">
            <img src="magnifying-glass.png" alt="Search" />
          </button>
          {/* Autocomplete dropdown */}
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
        </div>
      </header>

      {/* Main content */}
      <div className="mobile-content">
        {error && <p style={{ color: "red", padding: 10 }}>{error}</p>}
        {renderContent()}
      </div>

      {/* Bottom Nav */}
      <nav className="mobile-bottom-nav">
        <div className="nav-left">
          <div className="nav-item" onClick={() => handleNavClick("history")}>
            <img
              src={
                currentTab === "history"
                  ? icons.history.active
                  : icons.history.inactive
              }
              alt="History"
            />
            <span>History</span>
          </div>
          <div className="nav-item" onClick={() => handleNavClick("recipe")}>
            <img
              src={
                currentTab === "recipe"
                  ? icons.recipe.active
                  : icons.recipe.inactive
              }
              alt="Recipe"
            />
            <span>Recipe</span>
          </div>
          <div className="nav-item" onClick={() => handleNavClick("info")}>
            <img
              src={
                currentTab === "info"
                  ? icons.info.active
                  : icons.info.inactive
              }
              alt="Info"
            />
            <span>Info</span>
          </div>
        </div>

        <div className="ai-button-wrapper">
          <button
            className="ai-remix-button"
            onClick={handleAiButtonClick}
            style={{ backgroundColor: remixBgColor }}
          >
            {isLoading ? (
              <img src="/assets/icons/loading-spinner.svg" alt="Loading" />
            ) : remixIcon ? (
              <img src={remixIcon} alt="Remix" />
            ) : null}
          </button>
        </div>
      </nav>
    </div>
  );
}

// Immediately render
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<MobileApp />);
