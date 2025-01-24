import React, { useState } from "react";
import "./App.css";

function App() {
  const [title, setTitle] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [inputRecipe, setInputRecipe] = useState("");
  const [error, setError] = useState("");
  const [gridClass, setGridClass] = useState("fade-in"); // State for animation classes

  const handleSubmit = async (e, query) => {
    if (e) e.preventDefault(); // Prevent default form submission behavior
    setError("");
    setGridClass("fade-out"); // Start fade-out animation

    const recipeQuery = query || title;

    try {
      const response = await fetch(`http://127.0.0.1:5000/recommend?title=${recipeQuery}&n=10`);
      const data = await response.json();

      if (response.ok) {
        setTimeout(() => {
          setInputRecipe(data.input_recipe);
          setRecommendations(data.recommendations);
          setGridClass("fade-in"); // Trigger fade-in animation
        }, 500); // Wait for fade-out animation to complete
      } else {
        setError(data.error || "An error occurred");
        setGridClass("fade-in");
      }
    } catch (err) {
      setError("Failed to fetch recommendations. Please try again!");
      setGridClass("fade-in");
    }
  };

  const handleRecommendationClick = (recipeName) => {
    setTitle(""); // Clear the search bar
    handleSubmit(null, recipeName); // Use the clicked recipe as the new query
  };

  return (
    <div className="app-container">
      {/* Left Panel: Recipe Section */}
      <div className="panel left-panel">
        <h2 className="panel-title">Recipe</h2>
        <form onSubmit={handleSubmit} className="query-form">
          <input
            type="text"
            placeholder="Enter a recipe name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="query-input"
          />
          <button type="submit" className="query-button">
            <img
              src="/magnifying-glass.png" // Relative path from the `public` folder
              alt="Search"
              className="search-icon"
            />
          </button>
        </form>
        {inputRecipe && (
          <div className="closest-match">
            <h3>Because you searched:</h3>
            <p>{inputRecipe}</p>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}
      </div>

      {/* Right Panel: Recommender Section */}
      <div className="panel right-panel">
        <h2 className="panel-title">Recommender</h2>
        {recommendations.length > 0 ? (
          <div className={`recommendation-grid ${gridClass}`}>
            {recommendations.map((rec, index) => (
              <div
                className="recommendation-item"
                key={index}
                onClick={() => handleRecommendationClick(rec.recipe_name)} // Handle click
              >
                {rec.recipe_name}
              </div>
            ))}
          </div>
        ) : (
          <div className="placeholder">
            <p>Search for results</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
